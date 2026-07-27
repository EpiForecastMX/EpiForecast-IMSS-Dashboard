/**
 * rag_index.mjs — contrato ÚNICO del índice RAG: caché, generación, validación y escritura.
 *
 * Por qué existe: `build_rag_index.mjs` y `rag_staging.mjs` tenían cada uno su propia idea de qué
 * es un índice válido, y las dos eran permisivas. El builder toleraba clave ausente, fallo de API o
 * vector vacío y terminaba con rc=0 escribiendo un índice degradado; staging asignaba `[]` a los
 * chunks sin embedding y luego los daba por «sin drift», porque sólo comprobaba que el chunk
 * existiera. Un canal RAG que responde con búsqueda léxica porque le faltan vectores NO está listo,
 * y un verificador que no lo distingue produce falsos verdes (C7.6-RAG-A).
 *
 * Las reglas viven aquí una sola vez. Nadie más llama a Gemini, reintenta ni decide qué es válido.
 *
 * La asociación chunk↔vector es EXPLÍCITA (`hash` / `vectorHash`), no posicional: el builder
 * anterior escribía `vectors[i] = …`, y con arreglos paralelos una desalineación no deja rastro en
 * el archivo. Aquí el vector viaja con el hash para el que se pidió, y validar exige que coincidan.
 */

import { existsSync, readFileSync, writeFileSync, renameSync, unlinkSync } from 'fs';
import { chunkHash, embedInput, EMBED_MODEL, EMBED_DIM } from './corpus.mjs';

export { EMBED_MODEL, EMBED_DIM };

/** Fallo de contrato del índice. Lleva la lista completa de problemas, no sólo el primero. */
export class RagIndexError extends Error {
  constructor(problemas) {
    super(`índice RAG inválido:\n  - ${problemas.join('\n  - ')}`);
    this.name = 'RagIndexError';
    this.problemas = problemas;
  }
}

/** null si el vector es utilizable; si no, la razón concreta. */
export function vectorProblem(v, dim = EMBED_DIM) {
  if (!Array.isArray(v)) return 'no es un arreglo';
  if (!v.length) return 'vacío';
  if (v.length !== dim) return `dimensión ${v.length} ≠ ${dim}`;
  if (!v.every((x) => typeof x === 'number' && Number.isFinite(x))) return 'valor no finito';
  return null;
}

/** Frame de trabajo: una entrada por chunk, con su hash y sin vector todavía. */
export function frameFor(chunks) {
  return chunks.map((chunk) => ({ chunk, hash: chunkHash(chunk), vector: null, vectorHash: null }));
}

export function readIndex(path) {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch { return null; }
}

/**
 * Caché hash→vector desde un índice en disco. Un vector inválido NO se recicla: reusarlo
 * propagaría el defecto a la siguiente construcción en vez de regenerarlo.
 */
export function cacheFrom(index, { dim = EMBED_DIM } = {}) {
  const cache = new Map();
  if (!index) return cache;
  const chunks = index.chunks || [];
  const vectors = index.vectors || [];
  for (let i = 0; i < chunks.length; i++) {
    if (vectorProblem(vectors[i], dim)) continue;
    cache.set(chunkHash(chunks[i]), vectors[i]);
  }
  return cache;
}

/**
 * ÚNICA vía para poner un vector en una entrada: se pasa el hash PARA EL QUE se obtuvo y se exige
 * que sea el de la entrada. Con arreglos paralelos, una asignación posicional equivocada no deja
 * rastro en el archivo; obligando a declarar el origen, el error se detiene aquí.
 */
export function assignVector(entry, hash, vector) {
  if (hash !== entry.hash) {
    throw new RagIndexError([`chunk ${entry.chunk?.id ?? '?'}: se intentó asignarle el vector de ${String(hash).slice(0, 12)}`]);
  }
  entry.vector = vector;
  entry.vectorHash = hash;
  return entry;
}

/** Reutiliza por HASH, nunca por posición. → nº de vectores reutilizados */
export function applyCache(frame, cache) {
  let reused = 0;
  for (const e of frame) {
    const hit = cache.get(e.hash);
    if (hit) { assignVector(e, e.hash, hit); reused++; }
  }
  return reused;
}

/**
 * Genera los embeddings que faltan. FALLA CERRADO: sin proveedor, con el proveedor caído o con una
 * respuesta que no cumple el contrato, lanza `RagIndexError`. Nunca deja un vector vacío ni degrada
 * a modo léxico.
 */
export async function fillMissing(frame, { embed, concurrency = 8, retries = 4, dim = EMBED_DIM, onProgress = null, pause = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const pendientes = frame.filter((e) => e.vector === null);
  if (!pendientes.length) return { generated: 0 };
  if (typeof embed !== 'function') {
    throw new RagIndexError([`faltan ${pendientes.length} embeddings y no hay proveedor disponible`]);
  }

  const fallos = [];
  let cursor = 0, hechos = 0;
  async function worker() {
    while (cursor < pendientes.length) {
      const e = pendientes[cursor++];
      let ultimo = null;
      for (let intento = 1; intento <= retries; intento++) {
        try {
          const v = await embed(e.chunk);
          const p = vectorProblem(v, dim);
          // Un vector mal formado es un fallo de contrato, no un error transitorio: no se reintenta.
          if (p) { ultimo = `respuesta inválida (${p})`; intento = retries; break; }
          assignVector(e, e.hash, v);
          ultimo = null;
          break;
        } catch (err) {
          ultimo = err.message;
          if (intento < retries) await pause(200 * intento);
        }
      }
      if (ultimo) fallos.push(`chunk ${e.chunk.id}: ${ultimo}`);
      hechos++;
      if (onProgress) onProgress(hechos, pendientes.length);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, pendientes.length)) }, worker));
  if (fallos.length) throw new RagIndexError(fallos);
  return { generated: pendientes.length };
}

/**
 * Todos los problemas del frame. `expected` (hashes del corpus) activa además la comprobación de
 * cobertura: ni faltantes, ni extras, ni duplicados.
 */
export function problemsOf(frame, { dim = EMBED_DIM, expected = null } = {}) {
  const problemas = [];
  const cuenta = new Map();
  for (const e of frame) {
    const p = vectorProblem(e.vector, dim);
    if (p) problemas.push(`chunk ${e.chunk?.id ?? '?'}: vector ${p}`);
    else if (e.vectorHash !== e.hash) problemas.push(`chunk ${e.chunk?.id ?? '?'}: el vector pertenece a otro chunk`);
    cuenta.set(e.hash, (cuenta.get(e.hash) || 0) + 1);
  }
  for (const [h, n] of cuenta) if (n > 1) problemas.push(`chunk duplicado ${h.slice(0, 12)} (${n} veces)`);
  if (expected) {
    const esperados = new Set(expected);
    for (const h of esperados) if (!cuenta.has(h)) problemas.push(`falta el chunk ${h.slice(0, 12)} del corpus`);
    for (const h of cuenta.keys()) if (!esperados.has(h)) problemas.push(`chunk extra ${h.slice(0, 12)} (no está en el corpus)`);
  }
  return problemas;
}

export function assertValid(frame, opts = {}) {
  const problemas = problemsOf(frame, opts);
  if (problemas.length) throw new RagIndexError(problemas);
  return frame;
}

export function serialize(frame, { model = EMBED_MODEL, dim = EMBED_DIM, built = new Date().toISOString() } = {}) {
  return {
    model, dim, built,
    count: frame.length,
    chunks: frame.map((e) => e.chunk),
    vectors: frame.map((e) => e.vector),
  };
}

/**
 * Escritura atómica: temporal + rename. Ante fallo, el destino previo queda byte-idéntico y no
 * sobrevive ningún temporal. Escribir directo dejaba un índice a medias si el proceso moría.
 */
export function writeAtomic(path, obj) {
  const tmp = `${path}.tmp-${process.pid}`;
  try {
    writeFileSync(tmp, JSON.stringify(obj));
    renameSync(tmp, path);
  } finally {
    if (existsSync(tmp)) unlinkSync(tmp);
  }
}

/**
 * Construcción completa: caché → generación → validación → objeto serializable.
 * No escribe nada: quien llama decide dónde, y sólo se escribe lo ya validado.
 */
export async function buildIndex({ chunks, previous = null, embed = null, dim = EMBED_DIM, model = EMBED_MODEL, built, concurrency, retries, onProgress } = {}) {
  if (!chunks?.length) throw new RagIndexError(['el corpus está vacío']);
  const frame = frameFor(chunks);
  const reused = applyCache(frame, cacheFrom(previous, { dim }));
  const { generated } = await fillMissing(frame, { embed, dim, concurrency, retries, onProgress });
  assertValid(frame, { dim, expected: frame.map((e) => e.hash) });
  return { frame, reused, generated, index: serialize(frame, { model, dim, built }) };
}

/**
 * Verifica un índice YA escrito contra el corpus vigente. El archivo guarda arreglos paralelos, así
 * que la asociación se reconstruye por posición; la alineación se garantiza en construcción, y aquí
 * se comprueba lo que el archivo sí permite: cobertura, unicidad y validez de cada vector.
 */
export function problemsAgainstCorpus(index, chunks, { dim = EMBED_DIM } = {}) {
  if (!index) return ['no existe el índice'];
  const idxChunks = index.chunks || [];
  const idxVectors = index.vectors || [];
  if (idxChunks.length !== idxVectors.length) {
    return [`el índice declara ${idxChunks.length} chunks y ${idxVectors.length} vectores`];
  }
  const frame = idxChunks.map((chunk, i) => {
    const hash = chunkHash(chunk);
    return { chunk, hash, vector: idxVectors[i], vectorHash: hash };
  });
  return problemsOf(frame, { dim, expected: chunks.map(chunkHash) });
}

/**
 * Proveedor real. Se importa el SDK de forma perezosa para que las pruebas —que inyectan un
 * proveedor simulado— no dependan de él ni de la red. La clave llega por parámetro y NUNCA se
 * imprime ni se serializa.
 */
export async function geminiEmbedder(apiKey, { model = EMBED_MODEL, dim = EMBED_DIM } = {}) {
  if (!apiKey) throw new RagIndexError(['no hay GEMINI_API_KEY en el entorno']);
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const cliente = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model });
  return async (chunk) => {
    const res = await cliente.embedContent({
      content: { parts: [{ text: embedInput(chunk) }], role: 'user' },
      taskType: 'RETRIEVAL_DOCUMENT',
      outputDimensionality: dim,
    });
    const values = res?.embedding?.values;
    if (!Array.isArray(values)) throw new Error('la respuesta no trae vector');
    return values.slice(0, dim).map((v) => +v.toFixed(6));
  };
}
