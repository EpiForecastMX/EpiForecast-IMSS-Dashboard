/**
 * rag_staging.mjs — C7.3c: reindexa y verifica el RAG INCLUYENDO el corpus candidate,
 * escribiendo SOLO en staging.
 *
 * El `rag_index.json` commiteado no se toca: es la superficie publicada. Aquí se construye un índice
 * paralelo en el propio directorio de staging y se comprueba que cubre cada chunk del corpus
 * ampliado.
 *
 * C7.6-RAG-A: antes asignaba `[]` a los chunks sin embedding y a continuación los daba por «sin
 * drift», porque la verificación sólo miraba que el chunk existiera. Un chunk candidate con vector
 * vacío se reportaba como listo. Ahora usa el MISMO contrato que el builder público
 * (scripts/lib/rag_index.mjs): sin vector válido para cada chunk —candidate incluido— esto falla
 * con rc≠0 y no escribe nada.
 *
 * Uso:  GEMINI_API_KEY=... node scripts/rag_staging.mjs <staging_root>
 */

import { existsSync } from 'fs';
import { resolve, join } from 'path';
import { buildChunks, KB_DIR, EMBED_DIM, EMBED_MODEL } from './lib/corpus.mjs';
import { findShards } from './lib/candidate.mjs';
import { buildIndex, readIndex, writeAtomic, geminiEmbedder, RagIndexError } from './lib/rag_index.mjs';

const stagingRoot = resolve(process.argv[2] || '');
if (!process.argv[2] || !existsSync(stagingRoot)) {
  console.error('✖ Uso: node scripts/rag_staging.mjs <staging_root>');
  process.exit(2);
}

const shards = findShards(stagingRoot);
const publicado = resolve(KB_DIR, 'rag_index.json');
const salida = join(stagingRoot, 'rag_index.staging.json');

const base = buildChunks();
const ampliado = buildChunks({ candidateRoot: stagingRoot });
const nuevos = ampliado.chunks.length - base.chunks.length;

const apiKey = process.env.GEMINI_API_KEY;   // sólo se usa; nunca se imprime ni se serializa

try {
  const { index, reused, generated } = await buildIndex({
    chunks: ampliado.chunks,
    previous: readIndex(publicado),          // reusa por hash lo ya embebido del corpus público
    embed: apiKey ? await geminiEmbedder(apiKey) : null,
    dim: EMBED_DIM,
    model: EMBED_MODEL,
  });
  writeAtomic(salida, index);

  console.log(`shards candidate      : ${shards.map((s) => s.diseaseId).join(', ') || '(ninguno)'}`);
  console.log(`chunks publicados     : ${base.chunks.length}`);
  console.log(`chunks con candidate  : ${ampliado.chunks.length}  (+${nuevos})`);
  console.log(`vectores reutilizados : ${reused}`);
  console.log(`vectores generados    : ${generated}`);
  console.log(`índice de staging     : ${salida}`);
  console.log('rag_index.json público: SIN TOCAR');
  console.log('✔ el índice de staging cubre el corpus ampliado, con vector válido en cada chunk');
} catch (err) {
  if (err instanceof RagIndexError) {
    console.error(`✖ ${err.message}`);
    console.error('\n  No se escribió el índice de staging.');
    if (!apiKey) console.error('  Falta GEMINI_API_KEY en el entorno.');
    process.exit(1);
  }
  throw err;
}
