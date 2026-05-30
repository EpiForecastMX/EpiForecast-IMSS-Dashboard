/**
 * rag_verify.mjs — Guardarraíl de reindexado.
 *
 * Recalcula los chunks del corpus actual y verifica que el rag_index.json
 * commiteado los cubra (cada chunk presente y con vector). Si detecta "drift"
 * (notas/paper cambiaron pero el índice no se regeneró), sale con código 1.
 *
 * Uso:  npm run rag:verify   (no requiere API key)
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { buildChunks, chunkHash, KB_DIR } from './lib/corpus.mjs';

const OUT = resolve(KB_DIR, 'rag_index.json');

const { chunks } = buildChunks();
if (!existsSync(OUT)) {
  console.error('✖ No existe rag_index.json. Corre: npm run rag:build');
  process.exit(1);
}

const idx = JSON.parse(readFileSync(OUT, 'utf-8'));
const idxChunks = idx.chunks || [];
const idxVectors = idx.vectors || [];

// hashes presentes EN EL ÍNDICE y con vector no vacío
const vectored = new Set();
for (let i = 0; i < idxChunks.length; i++) {
  if (idxVectors[i] && idxVectors[i].length) vectored.add(chunkHash(idxChunks[i]));
}

let missing = 0;
const changedSources = new Map();
for (const c of chunks) {
  if (!vectored.has(chunkHash(c))) {
    missing++;
    changedSources.set(c.source, (changedSources.get(c.source) || 0) + 1);
  }
}

console.log(`▶ Verificación de índice RAG`);
console.log(`  corpus actual: ${chunks.length} chunks · índice: ${idxChunks.length} chunks (${vectored.size} con vector)`);

if (missing > 0) {
  console.error(`\n✖ DRIFT: ${missing} chunks del corpus no están en el índice (o sin vector).`);
  console.error('  Fuentes afectadas:');
  for (const [src, n] of [...changedSources].sort((a, b) => b[1] - a[1])) console.error(`    - ${src}: ${n}`);
  console.error('\n  Regenera el índice:  GEMINI_API_KEY=… npm run rag:build  (luego commit de rag_index.json)');
  process.exit(1);
}

console.log('\n✔ Índice sincronizado con el corpus.');
