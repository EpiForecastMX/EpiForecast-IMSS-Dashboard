/**
 * build_rag_index.mjs — Construye el índice RAG de EpiForecast-MX.
 *
 * - Ingesta + chunking en scripts/lib/corpus.mjs (consciente de secciones).
 * - CACHÉ INCREMENTAL por `chunkHash`: sólo se embeben los chunks nuevos o modificados.
 * - FALLA CERRADO (C7.6-RAG-A): sin clave habiendo embeddings que generar, con el proveedor caído
 *   o con una respuesta que no cumple el contrato, sale con rc≠0 y **no escribe nada**. Antes
 *   toleraba todo eso y terminaba en verde con un índice degradado a modo léxico; un canal RAG al
 *   que le faltan vectores no está listo, y decir que sí es un falso verde.
 * - La escritura es atómica y ocurre sólo después de validar el frame completo.
 *
 * Toda la lógica de caché, generación y validación vive en scripts/lib/rag_index.mjs.
 *
 * Uso:   GEMINI_API_KEY=... npm run rag:build
 */

import { resolve } from 'path';
import { buildChunks, KB_DIR, EMBED_MODEL, EMBED_DIM } from './lib/corpus.mjs';
import { buildIndex, readIndex, writeAtomic, geminiEmbedder, RagIndexError } from './lib/rag_index.mjs';

const OUT_PATH = resolve(KB_DIR, 'rag_index.json');

async function main() {
  console.log('▶ Construyendo índice RAG de EpiForecast-MX (incremental)\n');
  const { chunks, log } = buildChunks();
  for (const [name, n] of log) console.log(`  ${name}: ${n} chunks`);
  console.log(`\n  Total: ${chunks.length} chunks`);

  const previous = readIndex(OUT_PATH);
  const apiKey = process.env.GEMINI_API_KEY;   // sólo se usa; nunca se imprime ni se serializa
  const embed = apiKey ? await geminiEmbedder(apiKey) : null;

  const { index, reused, generated } = await buildIndex({
    chunks,
    previous,
    embed,
    dim: EMBED_DIM,
    model: EMBED_MODEL,
    onProgress: (hechos, total) => {
      if (hechos % 10 === 0 || hechos === total) process.stdout.write(`  embeddings ${hechos}/${total}\r`);
    },
  });
  if (generated) process.stdout.write('\n');

  writeAtomic(OUT_PATH, index);
  const mb = (Buffer.byteLength(JSON.stringify(index)) / 1e6).toFixed(2);
  console.log(`\n✔ rag_index.json — ${chunks.length} chunks con vector válido ` +
    `(reusados ${reused}, nuevos ${generated}), ${mb} MB`);
}

main().catch((err) => {
  if (err instanceof RagIndexError) {
    console.error(`\n✖ ${err.message}`);
    console.error('\n  No se escribió el índice: el anterior queda intacto.');
    if (!process.env.GEMINI_API_KEY) console.error('  Falta GEMINI_API_KEY en el entorno.');
  } else {
    console.error('\n✖ Error:', err);
  }
  process.exit(1);
});
