/**
 * build_rag_index.mjs — Construye el índice RAG de EpiForecast-MX.
 *
 * - Ingesta + chunking en scripts/lib/corpus.mjs (consciente de secciones).
 * - CACHÉ INCREMENTAL: reusa los vectores del rag_index.json existente para los
 *   chunks cuyo contenido no cambió (hash). Solo se embeben los chunks nuevos o
 *   modificados -> reindexar es barato (ideal para correr en cada deploy).
 * - RESILIENTE: si no hay GEMINI_API_KEY o falla el embedding, conserva los
 *   vectores en caché y deja vacíos los faltantes (modo léxico para esos). Nunca
 *   aborta el build con error.
 *
 * Uso:   GEMINI_API_KEY=... npm run rag:build
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { buildChunks, embedInput, chunkHash, KB_DIR, EMBED_MODEL, EMBED_DIM } from './lib/corpus.mjs';

const OUT_PATH = resolve(KB_DIR, 'rag_index.json');

function loadCache() {
  if (!existsSync(OUT_PATH)) return new Map();
  try {
    const old = JSON.parse(readFileSync(OUT_PATH, 'utf-8'));
    const map = new Map();
    const chunks = old.chunks || [];
    const vectors = old.vectors || [];
    for (let i = 0; i < chunks.length; i++) {
      const v = vectors[i];
      if (v && v.length) map.set(chunkHash(chunks[i]), v);
    }
    return map;
  } catch { return new Map(); }
}

async function embedMissing(chunks, vectors, apiKey) {
  const todo = [];
  for (let i = 0; i < chunks.length; i++) if (!vectors[i] || !vectors[i].length) todo.push(i);
  if (!todo.length) return { embedded: 0, failed: 0 };
  if (!apiKey) { console.warn(`\n⚠ ${todo.length} chunks sin vector y sin GEMINI_API_KEY: quedan en modo léxico.`); return { embedded: 0, failed: todo.length }; }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: EMBED_MODEL });
  async function embedOne(i) {
    const res = await model.embedContent({
      content: { parts: [{ text: embedInput(chunks[i]) }], role: 'user' },
      taskType: 'RETRIEVAL_DOCUMENT',
      outputDimensionality: EMBED_DIM,
    });
    vectors[i] = res.embedding.values.slice(0, EMBED_DIM).map(v => +v.toFixed(6));
  }
  let cursor = 0, done = 0, failed = 0;
  async function worker() {
    while (cursor < todo.length) {
      const i = todo[cursor++];
      let attempt = 0;
      while (true) {
        try { await embedOne(i); break; }
        catch (err) {
          attempt++;
          if (attempt >= 4) { console.warn(`\n  ⚠ chunk ${i} falló: ${err.message}`); failed++; break; }
          await new Promise(r => setTimeout(r, 500 * attempt));
        }
      }
      done++;
      if (done % 10 === 0 || done === todo.length) process.stdout.write(`  embeddings ${done}/${todo.length}\r`);
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  process.stdout.write('\n');
  return { embedded: done - failed, failed };
}

async function main() {
  console.log('▶ Construyendo índice RAG de EpiForecast-MX (incremental)\n');
  const { chunks, log } = buildChunks();
  for (const [name, n] of log) console.log(`  ${name}: ${n} chunks`);
  console.log(`\n  Total: ${chunks.length} chunks`);
  if (!chunks.length) { console.error('✖ Sin chunks; abortando.'); process.exit(1); }

  // Caché incremental: reusa vectores cuyo hash coincide
  const cache = loadCache();
  const vectors = new Array(chunks.length);
  let reused = 0;
  for (let i = 0; i < chunks.length; i++) {
    const hit = cache.get(chunkHash(chunks[i]));
    if (hit) { vectors[i] = hit; reused++; } else vectors[i] = null;
  }
  console.log(`  Caché: ${reused}/${chunks.length} vectores reutilizados, ${chunks.length - reused} por (re)generar.`);

  const apiKey = process.env.GEMINI_API_KEY;
  let stats = { embedded: 0, failed: 0 };
  try {
    if (chunks.length - reused > 0) {
      if (apiKey) console.log(`\n▶ Generando embeddings faltantes (${EMBED_MODEL})...`);
      stats = await embedMissing(chunks, vectors, apiKey);
    }
  } catch (err) {
    console.warn('\n⚠ Embedding falló de forma global; conservo lo disponible:', err.message);
  }

  const filledVectors = vectors.map(v => v || []);
  const withVec = filledVectors.filter(v => v.length).length;

  // Guardarraíl: si el resultado tiene MENOS vectores que el índice previo,
  // no lo sobrescribas (evita degradar un índice bueno por un fallo de API).
  if (existsSync(OUT_PATH)) {
    try {
      const prev = JSON.parse(readFileSync(OUT_PATH, 'utf-8'));
      const prevVec = (prev.vectors || []).filter(v => v && v.length).length;
      if (prevVec > withVec && withVec < chunks.length) {
        console.warn(`\n⚠ El índice previo tenía ${prevVec} vectores y este tendría ${withVec}. Conservo el previo (no degradar).`);
        return;
      }
    } catch { /* ignora */ }
  }

  const index = {
    model: EMBED_MODEL,
    dim: EMBED_DIM,
    built: new Date().toISOString(),
    count: chunks.length,
    chunks,
    vectors: filledVectors,
  };
  writeFileSync(OUT_PATH, JSON.stringify(index));
  const mb = (Buffer.byteLength(JSON.stringify(index)) / 1e6).toFixed(2);
  console.log(`\n✔ rag_index.json — ${chunks.length} chunks, ${withVec} con vector (reusados ${reused}, nuevos ${stats.embedded}, fallidos ${stats.failed}), ${mb} MB`);
}

main().catch(err => { console.error('\n✖ Error:', err); process.exit(1); });
