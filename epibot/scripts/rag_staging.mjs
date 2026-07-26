/**
 * rag_staging.mjs — C7.3c: reindexa y verifica el RAG INCLUYENDO el corpus candidate,
 * escribiendo SOLO en staging.
 *
 * El `rag_index.json` commiteado no se toca: es la superficie publicada. Aquí se construye un índice
 * paralelo en el propio directorio de staging y se comprueba que cubre cada chunk del corpus
 * ampliado. Así se responde la pregunta de C7.3 —«¿el índice se regenera sin drift con el corpus
 * nuevo?»— sin publicar nada.
 *
 * Uso:  node scripts/rag_staging.mjs <staging_root>
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { buildChunks, chunkHash, KB_DIR } from './lib/corpus.mjs';
import { findShards } from './lib/candidate.mjs';

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

// Reusa los vectores del índice publicado para lo que no cambió; los chunks candidate quedan sin
// vector (modo léxico), igual que hace el build normal sin API key. Nunca se aborta por eso.
const cache = new Map();
if (existsSync(publicado)) {
  const viejo = JSON.parse(readFileSync(publicado, 'utf-8'));
  (viejo.chunks || []).forEach((c, i) => {
    const v = (viejo.vectors || [])[i];
    if (v && v.length) cache.set(chunkHash(c), v);
  });
}
const vectors = ampliado.chunks.map((c) => cache.get(chunkHash(c)) || []);
writeFileSync(salida, JSON.stringify({ chunks: ampliado.chunks, vectors }, null, 0));

// Verificación de drift sobre el índice de staging: cada chunk del corpus ampliado tiene que estar.
const indice = JSON.parse(readFileSync(salida, 'utf-8'));
const presentes = new Set((indice.chunks || []).map(chunkHash));
const faltan = ampliado.chunks.filter((c) => !presentes.has(chunkHash(c)));

console.log(`shards candidate      : ${shards.map((s) => s.diseaseId).join(', ') || '(ninguno)'}`);
console.log(`chunks publicados     : ${base.chunks.length}`);
console.log(`chunks con candidate  : ${ampliado.chunks.length}  (+${nuevos})`);
console.log(`vectores reutilizados : ${vectors.filter((v) => v.length).length}`);
console.log(`índice de staging     : ${salida}`);
console.log(`rag_index.json público: SIN TOCAR`);
if (faltan.length) {
  console.error(`✖ drift: ${faltan.length} chunks del corpus no están en el índice`);
  process.exit(1);
}
console.log('✔ sin drift: el índice de staging cubre todo el corpus ampliado');
