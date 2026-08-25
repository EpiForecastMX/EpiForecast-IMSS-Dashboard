/**
 * cifras_verify.mjs — El contrato de vocabulario, como gate independiente.
 *
 * Vive aparte de `rag_verify` a propósito. Aquel comprueba primero que el índice cubra el
 * corpus y **sale con código 1 en cuanto detecta drift**, así que en cuanto el corpus
 * cambia —que es justo cuando se corrigen cifras— nunca llega a mirar lo que los chunks
 * dicen. Un gate que sólo corre cuando todo lo demás ya está bien no protege nada.
 *
 * Corre sin API key. Uso:  npm run cifras:verify
 */

import { resolve } from 'path';
import { readFileSync } from 'fs';
import { buildChunks, KB_DIR } from './lib/corpus.mjs';
import { problemasDeCifras, problemasDeKnowledge, VOCABULARIO } from './lib/cifras_contrato.mjs';

const { chunks } = buildChunks();

console.log('▶ Contrato de cifras públicas');
console.log(
  `  vocabulario: ${VOCABULARIO.neuro} neuro · ${VOCABULARIO.dengue} dengue · ` +
    `${VOCABULARIO.total} series productivas · ${VOCABULARIO.galeria} gráficos`
);

const problemas = problemasDeCifras(chunks);
console.log(`  corpus: ${chunks.length} chunks revisados`);

let kb = null;
try {
  kb = JSON.parse(readFileSync(resolve(KB_DIR, 'knowledge.json'), 'utf8'));
} catch (e) {
  problemas.push(`no se pudo leer knowledge.json: ${e.message}`);
}
if (kb) problemas.push(...problemasDeKnowledge(kb));

if (problemas.length) {
  console.error(`\n✖ Cifras fuera de contrato (${problemas.length}):`);
  for (const p of problemas.slice(0, 40)) console.error(`    - ${p}`);
  if (problemas.length > 40) console.error(`    … y ${problemas.length - 40} más`);
  console.error('\n  El JSON se corrige en el GENERADOR (build_web_knowledge.py), nunca a mano');
  console.error('  ni reparándolo en el navegador. Ver docs/CONTRATO_VOCABULARIO_CIFRAS.md.');
  process.exit(1);
}

console.log('\n✔ Corpus y knowledge.json dentro del contrato.');
