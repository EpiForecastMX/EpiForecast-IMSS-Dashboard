/**
 * test_rag_index.mjs — C7.6-RAG-A: el contrato del índice RAG falla cerrado.
 *
 * Lo que protege: el builder anterior toleraba clave ausente, error de API o vector vacío y
 * terminaba en verde escribiendo un índice degradado; `rag_staging.mjs` asignaba `[]` a los chunks
 * sin embedding y luego los daba por «sin drift». Un canal RAG al que le faltan vectores no está
 * listo — decir que sí es el falso verde que estas pruebas impiden.
 *
 * Todo con un proveedor SIMULADO: sin red, sin `GEMINI_API_KEY`, determinista.
 *
 * Uso: node --test tests/test_rag_index.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'fs';
import { createHash } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  buildIndex, frameFor, applyCache, assignVector, cacheFrom, fillMissing, problemsOf,
  problemsAgainstCorpus, serialize, writeAtomic, readIndex, vectorProblem, RagIndexError,
} from '../scripts/lib/rag_index.mjs';
import { chunkHash } from '../scripts/lib/corpus.mjs';

const DIM = 8;   // dimensión pequeña: el contrato no depende del tamaño real del modelo

const chunk = (id, text) => ({ id, source: 'prueba', title: id, text, url: null });
const CORPUS = [chunk('a', 'alfa'), chunk('b', 'beta'), chunk('c', 'gama')];

/** Proveedor determinista: vector derivado del texto. Cuenta cuántas veces se le pide. */
function proveedor({ falla = null, dim = DIM } = {}) {
  const pedidos = [];
  const embed = async (c) => {
    pedidos.push(c.id);
    if (falla) throw new Error(falla);
    const h = createHash('sha1').update(c.text).digest();
    return Array.from({ length: dim }, (_, i) => +(h[i % h.length] / 255).toFixed(6));
  };
  return { embed, pedidos };
}

// async: el `finally` no puede borrar el directorio mientras el cuerpo sigue corriendo.
const conDir = async (fn) => {
  const dir = mkdtempSync(join(tmpdir(), 'rag-'));
  try { return await fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
};

test('índice completamente cubierto: PASS', async () => {
  const { index, reused, generated } = await buildIndex({ chunks: CORPUS, embed: proveedor().embed, dim: DIM });
  assert.equal(index.count, 3);
  assert.equal(index.chunks.length, index.vectors.length);
  assert.equal(reused, 0);
  assert.equal(generated, 3);
  assert.deepEqual(problemsAgainstCorpus(index, CORPUS, { dim: DIM }), []);
});

test('chunk ausente en el índice: FAIL', async () => {
  const { index } = await buildIndex({ chunks: CORPUS.slice(0, 2), embed: proveedor().embed, dim: DIM });
  const problemas = problemsAgainstCorpus(index, CORPUS, { dim: DIM });
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /falta el chunk .* del corpus/);
});

test('vector vacío: FAIL (no es "modo léxico", es un índice inválido)', async () => {
  const { index } = await buildIndex({ chunks: CORPUS, embed: proveedor().embed, dim: DIM });
  index.vectors[1] = [];
  const problemas = problemsAgainstCorpus(index, CORPUS, { dim: DIM });
  assert.equal(problemas.length, 1);
  assert.match(problemas[0], /vector vacío/);
});

test('dimensión incorrecta o valor no finito: FAIL', async () => {
  const { index } = await buildIndex({ chunks: CORPUS, embed: proveedor().embed, dim: DIM });
  const bueno = index.vectors[0].slice();
  index.vectors[0] = bueno.slice(0, DIM - 1);
  assert.match(problemsAgainstCorpus(index, CORPUS, { dim: DIM })[0], /dimensión 7 ≠ 8/);
  index.vectors[0] = bueno.slice(); index.vectors[0][3] = NaN;
  assert.match(problemsAgainstCorpus(index, CORPUS, { dim: DIM })[0], /valor no finito/);
  index.vectors[0] = bueno.slice(); index.vectors[0][3] = 'x';
  assert.match(problemsAgainstCorpus(index, CORPUS, { dim: DIM })[0], /valor no finito/);
});

test('chunk y vector desalineados: FAIL', async () => {
  // El bug clásico del builder anterior: `vectors[i] = …`, el vector de un chunk en la ranura de
  // otro. El vector viaja con el hash para el que se pidió, así que la mentira queda a la vista.
  const { frame } = await buildIndex({ chunks: CORPUS, embed: proveedor().embed, dim: DIM });
  const v0 = { vector: frame[0].vector, hash: frame[0].vectorHash };
  frame[0].vector = frame[1].vector; frame[0].vectorHash = frame[1].vectorHash;
  frame[1].vector = v0.vector; frame[1].vectorHash = v0.hash;
  const problemas = problemsOf(frame, { dim: DIM, expected: frame.map((e) => e.hash) });
  assert.equal(problemas.length, 2, problemas.join(' · '));
  for (const p of problemas) assert.match(p, /el vector pertenece a otro chunk/);

  // Y la única vía de asignación lo impide de entrada, en vez de dejarlo para la validación.
  assert.throws(() => assignVector(frame[0], frame[1].hash, frame[1].vector), RagIndexError);
});

test('chunk duplicado: FAIL', async () => {
  await assert.rejects(
    () => buildIndex({ chunks: [...CORPUS, CORPUS[0]], embed: proveedor().embed, dim: DIM }),
    (err) => err instanceof RagIndexError && /chunk duplicado .* \(2 veces\)/.test(err.message),
  );
});

test('fallo permanente del proveedor: FAIL y el destino previo queda intacto', () => conDir(async (dir) => {
  const destino = join(dir, 'rag_index.json');
  const { index } = await buildIndex({ chunks: CORPUS.slice(0, 2), embed: proveedor().embed, dim: DIM });
  writeAtomic(destino, index);
  const antes = readFileSync(destino);

  await assert.rejects(
    () => buildIndex({ chunks: CORPUS, previous: readIndex(destino), embed: proveedor({ falla: 'rate limit' }).embed, dim: DIM, retries: 2 }),
    (err) => err instanceof RagIndexError && /rate limit/.test(err.message),
  );
  assert.deepEqual(readFileSync(destino), antes, 'el índice previo debe quedar byte-idéntico');
  assert.deepEqual(readdirSync(dir), ['rag_index.json'], 'no puede quedar ningún temporal');
}));

test('sin proveedor y con embeddings faltantes: FAIL (nunca vectores vacíos)', async () => {
  await assert.rejects(
    () => buildIndex({ chunks: CORPUS, embed: null, dim: DIM }),
    (err) => err instanceof RagIndexError && /no hay proveedor disponible/.test(err.message),
  );
});

test('respuesta del proveedor sin vector o vacía: FAIL, sin reintentar en vano', async () => {
  const pedidos = [];
  const embed = async (c) => { pedidos.push(c.id); return []; };
  await assert.rejects(
    () => buildIndex({ chunks: [CORPUS[0]], embed, dim: DIM, retries: 4 }),
    (err) => err instanceof RagIndexError && /respuesta inválida \(vacío\)/.test(err.message),
  );
  assert.equal(pedidos.length, 1, 'un contrato roto no es un error transitorio: no se reintenta');
});

test('caché válida: no se vuelve a pedir el embedding', async () => {
  const primero = proveedor();
  const { index } = await buildIndex({ chunks: CORPUS, embed: primero.embed, dim: DIM });
  assert.deepEqual(primero.pedidos, ['a', 'b', 'c']);

  const segundo = proveedor();
  const r = await buildIndex({ chunks: CORPUS, previous: index, embed: segundo.embed, dim: DIM });
  assert.deepEqual(segundo.pedidos, [], 'todo debía salir de la caché');
  assert.equal(r.reused, 3);
  assert.deepEqual(r.index.vectors, index.vectors);
});

test('la caché NO recicla vectores inválidos: los regenera', async () => {
  const { index } = await buildIndex({ chunks: CORPUS, embed: proveedor().embed, dim: DIM });
  index.vectors[2] = [];                       // un índice degradado que ya estuviera en disco
  const p = proveedor();
  const r = await buildIndex({ chunks: CORPUS, previous: index, embed: p.embed, dim: DIM });
  assert.deepEqual(p.pedidos, ['c'], 'el vector vacío debe regenerarse, no reutilizarse');
  assert.deepEqual(problemsAgainstCorpus(r.index, CORPUS, { dim: DIM }), []);
});

test('un chunk candidate nuevo exige embedding real, no []', async () => {
  const { index } = await buildIndex({ chunks: CORPUS, embed: proveedor().embed, dim: DIM });
  const candidate = chunk('candidate:padecimiento_x:0', 'ficha del padecimiento candidate');
  const ampliado = [...CORPUS, candidate];

  // Sin proveedor —el caso de staging sin clave— tiene que fallar, no rellenar con [].
  await assert.rejects(
    () => buildIndex({ chunks: ampliado, previous: index, embed: null, dim: DIM }),
    (err) => err instanceof RagIndexError && /faltan 1 embeddings/.test(err.message),
  );

  const p = proveedor();
  const r = await buildIndex({ chunks: ampliado, previous: index, embed: p.embed, dim: DIM });
  assert.deepEqual(p.pedidos, [candidate.id], 'sólo el candidate necesitaba vector');
  const i = r.index.chunks.findIndex((c) => c.id === candidate.id);
  assert.equal(vectorProblem(r.index.vectors[i], DIM), null, 'el candidate debe tener vector válido');
});

test('la escritura es atómica y sólo ocurre tras validar', () => conDir((dir) => {
  const destino = join(dir, 'idx.json');
  writeAtomic(destino, { hola: 1 });
  assert.deepEqual(readIndex(destino), { hola: 1 });
  assert.deepEqual(readdirSync(dir), ['idx.json']);
}));

test('caché y validación son las MISMAS para builder y staging', async () => {
  // Una sola implementación: si alguien duplica reglas, este test deja de significar algo, así que
  // se comprueba que las piezas exportadas son las que ambos scripts importan.
  const publico = readFileSync(new URL('../scripts/build_rag_index.mjs', import.meta.url), 'utf-8');
  const staging = readFileSync(new URL('../scripts/rag_staging.mjs', import.meta.url), 'utf-8');
  for (const [nombre, src] of [['build', publico], ['staging', staging]]) {
    assert.match(src, /from '\.\/lib\/rag_index\.mjs'/, `${nombre} debe consumir el contrato compartido`);
    assert.ok(!/GoogleGenerativeAI/.test(src), `${nombre} no puede llamar a Gemini por su cuenta`);
    assert.ok(!/vectors\[i\]\s*=/.test(src), `${nombre} no puede asignar vectores por posición`);
  }
});

test('el frame reutiliza por hash, no por posición', () => {
  const frame = frameFor(CORPUS);
  const cache = new Map([[chunkHash(CORPUS[2]), Array(DIM).fill(0.5)]]);
  assert.equal(applyCache(frame, cache), 1);
  assert.equal(frame[2].vector.length, DIM, 'el vector debe caer en SU chunk');
  assert.equal(frame[0].vector, null);
  assert.equal(frame[1].vector, null);
});

test('cacheFrom descarta lo inválido en vez de propagarlo', () => {
  const index = serialize(frameFor(CORPUS).map((e, i) => ({ ...e, vector: i === 0 ? Array(DIM).fill(0.1) : [], vectorHash: e.hash })), { dim: DIM });
  const cache = cacheFrom(index, { dim: DIM });
  assert.equal(cache.size, 1);
  assert.ok(cache.has(chunkHash(CORPUS[0])));
});

test('fillMissing no reintenta indefinidamente y reporta cada chunk fallido', async () => {
  const frame = frameFor(CORPUS);
  let intentos = 0;
  const embed = async () => { intentos++; throw new Error('503'); };
  await assert.rejects(
    () => fillMissing(frame, { embed, dim: DIM, retries: 3, concurrency: 1, pause: async () => {} }),
    (err) => err instanceof RagIndexError && err.problemas.length === 3,
  );
  assert.equal(intentos, 9, '3 chunks × 3 intentos');
});
