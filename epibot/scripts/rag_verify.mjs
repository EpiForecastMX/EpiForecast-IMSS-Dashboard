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
import { problemasDeCifras, problemasDeKnowledge } from './lib/cifras_contrato.mjs';
import { readFileSync } from 'fs';

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

// ---------------------------------------------------------------------------------------
// Contrato de cifras. Lo anterior comprueba que cada chunk TENGA un vector; esto comprueba
// lo que el chunk DICE. El 24-ago-2026 el índice estaba perfectamente sincronizado y
// perfectamente equivocado: 454 vectores válidos, y cinco tarjetas afirmando 435 modelos.
// Ver EpiForecast-MX/docs/CONTRATO_VOCABULARIO_CIFRAS.md.
// ---------------------------------------------------------------------------------------
console.log('\n▶ Contrato de cifras públicas');

const malas = problemasDeCifras(chunks);

let kb = null;
try {
  kb = JSON.parse(readFileSync(resolve(KB_DIR, 'knowledge.json'), 'utf8'));
} catch {
  malas.push('no se pudo leer knowledge.json para comprobar el inventario');
}
if (kb) malas.push(...problemasDeKnowledge(kb));

if (malas.length) {
  console.error(`\n✖ Cifras fuera de contrato (${malas.length}):`);
  for (const p of malas.slice(0, 30)) console.error(`    - ${p}`);
  if (malas.length > 30) console.error(`    … y ${malas.length - 30} más`);
  console.error('\n  Vocabulario vigente: 333 neuro · 99 dengue · 432 series productivas · 444 gráficos.');
  console.error('  El JSON se corrige en el GENERADOR (build_web_knowledge.py), nunca a mano ni en el navegador.');
  process.exit(1);
}

console.log('  ok  333 neuro · 99 dengue · 432 series · 444 gráficos; sin cifras retiradas en el corpus.');
