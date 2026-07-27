/**
 * rag_verify.mjs — Guardarraíl de reindexado.
 *
 * Recalcula los chunks del corpus actual y verifica que el rag_index.json commiteado los cubra:
 * cada chunk presente exactamente una vez y con un vector válido —no vacío, de la dimensión
 * declarada y con valores finitos—. Si detecta drift (las notas o el paper cambiaron y el índice no
 * se regeneró) o vectores inservibles, sale con código 1.
 *
 * Las reglas son las mismas que usa el builder: viven en scripts/lib/rag_index.mjs (C7.6-RAG-A).
 *
 * Uso:  npm run rag:verify   (no requiere API key)
 */

import { resolve } from 'path';
import { buildChunks, KB_DIR, EMBED_DIM, EMBED_MODEL } from './lib/corpus.mjs';
import { readIndex, problemsAgainstCorpus } from './lib/rag_index.mjs';

const OUT = resolve(KB_DIR, 'rag_index.json');

const { chunks } = buildChunks();
const idx = readIndex(OUT);
if (!idx) {
  console.error('✖ No existe (o no se puede leer) rag_index.json. Corre: npm run rag:build');
  process.exit(1);
}

// Identidad explícita: el índice tiene que declarar el MISMO modelo y dimensión que el
// corpus vigente, no sólo cubrir sus chunks (R68-P0).
const problemas = problemsAgainstCorpus(idx, chunks, { dim: EMBED_DIM, model: EMBED_MODEL });

console.log('▶ Verificación de índice RAG');
console.log(`  corpus actual: ${chunks.length} chunks · índice: ${(idx.chunks || []).length} chunks`);
console.log(`  modelo esperado: ${EMBED_MODEL} · dim ${EMBED_DIM} · índice declara: ${idx.model ?? '—'} / ${idx.dim ?? '—'}`);

if (problemas.length) {
  console.error(`\n✖ El índice no cumple el contrato (${problemas.length} problemas):`);
  for (const p of problemas.slice(0, 25)) console.error(`    - ${p}`);
  if (problemas.length > 25) console.error(`    … y ${problemas.length - 25} más`);
  console.error('\n  Regenera el índice:  GEMINI_API_KEY=… npm run rag:build  (luego commit de rag_index.json)');
  process.exit(1);
}

console.log('\n✔ Índice sincronizado con el corpus: un vector válido por chunk, sin faltantes ni duplicados.');
