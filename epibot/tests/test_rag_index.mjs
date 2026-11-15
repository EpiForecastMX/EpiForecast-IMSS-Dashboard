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
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync, statSync } from 'fs';
import { execFileSync, spawnSync } from 'child_process';
import { createHash } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  buildIndex, frameFor, applyCache, assignVector, cacheFrom, fillMissing, problemsOf,
  problemsAgainstCorpus, sameEmbeddingIdentity, serialize, writeAtomic, writeAtomicIfChanged, readIndex,
  vectorProblem, RagIndexError,
} from '../scripts/lib/rag_index.mjs';
import { chunkHash, buildChunks, EMBED_MODEL, EMBED_DIM } from '../scripts/lib/corpus.mjs';

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
  // Dos quejas por el mismo hecho, y las dos son ciertas: falta un chunk y el `count` declarado ya
  // no cuadra con el corpus (A.1 añadió la comprobación de metadata).
  assert.ok(problemas.some((p) => /falta el chunk .* del corpus/.test(p)), problemas.join(' · '));
  assert.ok(problemas.some((p) => /count 2 ≠ 3 chunks del corpus/.test(p)), problemas.join(' · '));
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

// ── Identidad del espacio de embeddings (R68-P0) ────────────────────────────────────────────────

test('cambiar de modelo con la MISMA dimensión invalida la caché entera', async () => {
  const { index } = await buildIndex({ chunks: CORPUS, embed: proveedor().embed, dim: DIM, model: 'model-A' });
  assert.equal(index.model, 'model-A');

  const p = proveedor();
  const r = await buildIndex({ chunks: CORPUS, previous: index, embed: p.embed, dim: DIM, model: 'model-B' });
  assert.equal(r.reused, 0, 'un vector de model-A no vale para un índice de model-B');
  assert.equal(r.generated, 3);
  assert.deepEqual(p.pedidos, ['a', 'b', 'c'], 'hay que pedirlos todos de nuevo');
  assert.equal(r.index.model, 'model-B');
});

test('cambiar de dimensión invalida la caché entera', async () => {
  const { index } = await buildIndex({ chunks: CORPUS, embed: proveedor({ dim: DIM }).embed, dim: DIM });
  const p = proveedor({ dim: DIM * 2 });
  const r = await buildIndex({ chunks: CORPUS, previous: index, embed: p.embed, dim: DIM * 2 });
  assert.equal(r.reused, 0);
  assert.equal(p.pedidos.length, 3);
  assert.equal(r.index.dim, DIM * 2);
});

test('misma identidad y mismo hash: sí reutiliza', () => {
  const frame = frameFor(CORPUS);
  const index = serialize(frame.map((e) => assignVector(e, e.hash, Array(DIM).fill(0.25))), { dim: DIM, model: 'model-A' });
  assert.equal(cacheFrom(index, { dim: DIM, model: 'model-A' }).size, 3);
  assert.equal(cacheFrom(index, { dim: DIM, model: 'model-B' }).size, 0);
  assert.equal(cacheFrom(index, { dim: DIM + 1, model: 'model-A' }).size, 0);
});

test('hash duplicado con vectores distintos: no se resuelve con "el último gana"', () => {
  const index = {
    model: 'model-A', dim: DIM, count: 2,
    chunks: [CORPUS[0], CORPUS[0]],
    vectors: [Array(DIM).fill(0.1), Array(DIM).fill(0.9)],
  };
  const cache = cacheFrom(index, { dim: DIM, model: 'model-A' });
  assert.equal(cache.size, 0, 'ante dos vectores para el mismo chunk, ninguno se reutiliza');

  // Duplicado idéntico: no hay ambigüedad, se puede reutilizar.
  const iguales = { ...index, vectors: [Array(DIM).fill(0.1), Array(DIM).fill(0.1)] };
  assert.equal(cacheFrom(iguales, { dim: DIM, model: 'model-A' }).size, 1);
});

test('el verificador exige metadata correcta, no sólo cobertura', async () => {
  const { index } = await buildIndex({ chunks: CORPUS, embed: proveedor().embed, dim: DIM, model: 'model-A' });
  const ok = (i) => problemsAgainstCorpus(i, CORPUS, { dim: DIM, model: 'model-A' });
  assert.deepEqual(ok(index), []);

  const casos = [
    [{ ...index, model: 'model-B' }, /modelo model-B ≠ model-A/],
    [{ ...index, model: undefined }, /no declara `model`/],
    [{ ...index, dim: DIM + 1 }, /dimensión declarada 9 ≠ 8/],
    [{ ...index, dim: '8' }, /no declara `dim` numérico/],
    [{ ...index, count: 99 }, /count 99 ≠ 3 chunks del corpus/],
    [{ ...index, count: undefined }, /no declara `count` numérico/],
    [{ ...index, chunks: undefined }, /`chunks` ausente/],
    [{ ...index, vectors: 'x' }, /`vectors` ausente o no es un arreglo/],
    [{ ...index, vectors: index.vectors.slice(0, 2) }, /declara 3 chunks y 2 vectores/],
  ];
  for (const [mutado, patron] of casos) {
    const problemas = ok(mutado);
    assert.ok(problemas.length, `${patron} debería fallar`);
    assert.ok(problemas.some((p) => patron.test(p)), `esperaba ${patron}, hubo: ${problemas.join(' · ')}`);
  }
});

// ── Contrato de CI (R68-P0) ─────────────────────────────────────────────────────────────────────

/**
 * Ejecuta el `rag:ci` REAL —la cadena se lee del package.json del repo, no se copia aquí— con
 * `rag:build` y `rag:verify` sustituidos por stubs que dejan constancia de haber corrido.
 */
function correrCI({ conClave, verifyRc }) {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));
  return conDir(async (dir) => {
    const marca = (n) => join(dir, `${n}.marca`).replace(/\\/g, '/');
    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      name: 'ci-stub', version: '1.0.0', private: true,
      scripts: {
        'rag:ci': pkg.scripts['rag:ci'],
        'rag:build': `node -e "require('fs').writeFileSync('${marca('build')}','1')"`,
        'rag:verify': `node -e "require('fs').writeFileSync('${marca('verify')}','1');process.exit(${verifyRc})"`,
      },
    }));
    const env = { ...process.env };
    if (conClave) env.GEMINI_API_KEY = 'no-usada-por-los-stubs';
    else delete env.GEMINI_API_KEY;
    let code = 0;
    try { execFileSync('npm', ['run', 'rag:ci'], { cwd: dir, env, stdio: 'pipe' }); }
    catch (err) { code = err.status ?? 1; }
    return {
      code,
      construyo: existsSync(join(dir, 'build.marca')),
      verifico: existsSync(join(dir, 'verify.marca')),
    };
  });
}

test('rag:ci sin clave: no construye, pero SÍ verifica y respeta su veredicto', async () => {
  const sano = await correrCI({ conClave: false, verifyRc: 0 });
  assert.deepEqual(sano, { code: 0, construyo: false, verifico: true });

  // El falso verde de R68-P0: sin clave daba rc=0 aunque el índice commiteado estuviera roto.
  const roto = await correrCI({ conClave: false, verifyRc: 1 });
  assert.equal(roto.construyo, false, 'sin clave no puede reconstruir');
  assert.equal(roto.verifico, true, 'sin clave TIENE que verificar el índice commiteado');
  assert.notEqual(roto.code, 0, 'si el índice commiteado tiene drift, rag:ci debe fallar');
});

test('rag:ci con clave: construye y verifica, en ese orden', async () => {
  const r = await correrCI({ conClave: true, verifyRc: 0 });
  assert.deepEqual(r, { code: 0, construyo: true, verifico: true });
  const conDrift = await correrCI({ conClave: true, verifyRc: 1 });
  assert.equal(conDrift.construyo, true);
  assert.notEqual(conDrift.code, 0);
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

// ── NOOP sin cambios materiales: `built` y bytes reproducibles ──────────────────────────────────
//
// Hallazgo root (preview 98): `rag:ci` con clave corre `rag:build` en cada deploy, y el builder
// reescribía `built` con la hora actual aunque chunks y vectores fueran idénticos. El JSON servido
// difería del commiteado SÓLO en `built`. `built` fecha la última generación MATERIAL; sin cambios
// materiales el builder es NOOP. Cualquier cambio real sí obtiene un `built` nuevo.

const BUILT_PREVIO = '2026-01-01T00:00:00.000Z';
const BUILT_NUEVO = '2026-02-02T00:00:00.000Z';

async function indicePrevio() {
  const { index } = await buildIndex({ chunks: CORPUS, embed: proveedor().embed, dim: DIM, built: BUILT_PREVIO });
  // Como llega del disco: parseado, no el mismo objeto en memoria.
  return JSON.parse(JSON.stringify(index));
}

test('NOOP: corpus, vectores, modelo, dim y esquema idénticos conservan built y bytes, sin pedir embeddings', async () => {
  const previo = await indicePrevio();
  const p = proveedor();
  const r = await buildIndex({ chunks: CORPUS, previous: previo, embed: p.embed, dim: DIM, built: BUILT_NUEVO });
  assert.deepEqual(p.pedidos, [], 'sin cambios no se llama al proveedor');
  assert.equal(r.unchanged, true);
  assert.equal(r.index.built, BUILT_PREVIO, 'built es la fecha de la última generación material');
  assert.equal(JSON.stringify(r.index), JSON.stringify(previo), 'mismos bytes');
});

test('cambios materiales reales SÍ producen built nuevo (texto, metadata fuera del hash, orden, modelo, esquema)', async () => {
  const previo = await indicePrevio();
  const casos = {
    'texto de un chunk': { chunks: [CORPUS[0], CORPUS[1], chunk('c', 'gama nueva')] },
    'metadata que no entra al hash (url)': { chunks: [CORPUS[0], CORPUS[1], { ...CORPUS[2], url: 'https://x/y' }] },
    'metadata que no entra al hash (id)': { chunks: [CORPUS[0], CORPUS[1], { ...CORPUS[2], id: 'c2' }] },
    'orden de los chunks': { chunks: [CORPUS[1], CORPUS[0], CORPUS[2]] },
    'chunk eliminado': { chunks: [CORPUS[0], CORPUS[1]] },
    'modelo distinto': { chunks: CORPUS, model: 'otro-modelo' },
  };
  for (const [nombre, extra] of Object.entries(casos)) {
    const r = await buildIndex({ previous: previo, embed: proveedor().embed, dim: DIM, built: BUILT_NUEVO, ...extra });
    assert.equal(r.unchanged, false, nombre);
    assert.equal(r.index.built, BUILT_NUEVO, `${nombre}: built nuevo`);
  }
  // Esquema del previo distinto (clave extra o sin built): no es «el mismo índice».
  for (const [nombre, prev] of Object.entries({
    'clave extra en el previo': { ...previo, legacy: true },
    'previo sin built': (({ built, ...resto }) => resto)(previo),
    // Un vector previo inválido no se recicla: se regenera, y eso es una generación material.
    'vector previo inválido': { ...previo, vectors: previo.vectors.map((v, i) => (i ? v : [])) },
  })) {
    const r = await buildIndex({ chunks: CORPUS, previous: prev, embed: proveedor().embed, dim: DIM, built: BUILT_NUEVO });
    assert.equal(r.unchanged, false, nombre);
    assert.equal(r.index.built, BUILT_NUEVO, `${nombre}: built nuevo`);
  }
});

test('cambio de dimensión: regenera todo y fecha built nuevo', async () => {
  const previo = await indicePrevio();
  const p = proveedor({ dim: 4 });
  const r = await buildIndex({ chunks: CORPUS, previous: previo, embed: p.embed, dim: 4, built: BUILT_NUEVO });
  assert.equal(p.pedidos.length, 3);
  assert.equal(r.unchanged, false);
  assert.equal(r.index.built, BUILT_NUEVO);
});

test('writeAtomicIfChanged: mismos bytes no toca el archivo (ni mtime); bytes distintos escribe', () => conDir(async (dir) => {
  const destino = join(dir, 'rag_index.json');
  const obj = { model: 'm', dim: 1, built: BUILT_PREVIO, count: 0, chunks: [], vectors: [] };
  assert.equal(writeAtomicIfChanged(destino, obj), true, 'no existía: escribe');
  const antes = statSync(destino).mtimeMs;
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(writeAtomicIfChanged(destino, JSON.parse(JSON.stringify(obj))), false, 'idéntico: NOOP');
  assert.equal(statSync(destino).mtimeMs, antes, 'NOOP no toca mtime');
  assert.equal(writeAtomicIfChanged(destino, { ...obj, built: BUILT_NUEVO }), true);
  assert.equal(JSON.parse(readFileSync(destino, 'utf-8')).built, BUILT_NUEVO);
  assert.deepEqual(readdirSync(dir), ['rag_index.json'], 'sin temporales');
}));

/**
 * El BUILDER REAL sobre el corpus REAL (cientos de chunks), hermético: el índice previo se arma con
 * vectores simulados de la dimensión real, así que todo sale de la caché. Corre dos veces: sin
 * clave y con una clave falsa; si el builder llamara a la API, la clave falsa lo haría fallar.
 */
test('builder real sobre el corpus real: sin cambios materiales es NOOP byte a byte, sin llamar a la API', () => conDir(async (dir) => {
  const { chunks } = buildChunks();
  assert.ok(chunks.length > 100, `corpus real (${chunks.length} chunks)`);
  const vector = (c) => {
    const h = createHash('sha256').update(chunkHash(c)).digest();
    return Array.from({ length: EMBED_DIM }, (_, i) => +(h[i % h.length] / 255 - 0.5).toFixed(6));
  };
  const previo = {
    model: EMBED_MODEL, dim: EMBED_DIM, built: BUILT_PREVIO, count: chunks.length,
    chunks, vectors: chunks.map(vector),
  };
  const destino = join(dir, 'rag_index.json');
  writeFileSync(destino, JSON.stringify(previo));
  const bytes = readFileSync(destino);
  const mtime = statSync(destino).mtimeMs;
  const script = new URL('../scripts/build_rag_index.mjs', import.meta.url).pathname;

  for (const clave of [null, 'clave-falsa-no-valida']) {
    const env = { ...process.env };
    if (clave) env.GEMINI_API_KEY = clave; else delete env.GEMINI_API_KEY;
    const r = spawnSync(process.execPath, [script, `--out=${destino}`], { env, encoding: 'utf-8' });
    assert.equal(r.status, 0, `rc del builder (${clave ? 'clave falsa' : 'sin clave'}): ${r.stderr}`);
    assert.match(r.stdout, /NOOP/);
    assert.match(r.stdout, /nuevos 0\)/);
    assert.ok(readFileSync(destino).equals(bytes), 'bytes idénticos, built incluido');
    assert.equal(statSync(destino).mtimeMs, mtime, 'el archivo no se reescribió');
  }
  assert.deepEqual(readdirSync(dir), ['rag_index.json'], 'sin temporales');

  // Contraprueba: un cambio material real (metadata fuera del hash) SÍ reescribe con built nuevo,
  // reutilizando vectores (sin API).
  const cambiado = { ...previo, chunks: previo.chunks.map((c, i) => (i ? c : { ...c, url: 'https://cambio.invalid/' })) };
  writeFileSync(destino, JSON.stringify(cambiado));
  const env = { ...process.env };
  delete env.GEMINI_API_KEY;
  const r = spawnSync(process.execPath, [script, `--out=${destino}`], { env, encoding: 'utf-8' });
  assert.equal(r.status, 0, r.stderr);
  const nuevo = JSON.parse(readFileSync(destino, 'utf-8'));
  assert.notEqual(nuevo.built, BUILT_PREVIO, 'cambio real: built nuevo');
  assert.ok(Date.parse(nuevo.built) > Date.parse(BUILT_PREVIO));
  assert.deepEqual(nuevo.chunks, chunks, 'vuelve al corpus vigente');
  assert.deepEqual(nuevo.vectors, previo.vectors, 'vectores reutilizados por hash');
}));
