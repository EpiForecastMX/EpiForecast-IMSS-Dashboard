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
import { readFileSync, readdirSync } from 'fs';
import { buildChunks, KB_DIR } from './lib/corpus.mjs';
import {
  problemasDeCifras,
  problemasDeKnowledge,
  problemasDelBannerEstatico,
  problemasDeSuperficies,
  VOCABULARIO,
} from './lib/cifras_contrato.mjs';

// `netlify.toml` publica con `publish = "."` desde la raiz del repo, un nivel por encima
// de `epibot/`. Todo .html/.json de ahi lo sirve el sitio.
const RAIZ_PUBLICADA = resolve(KB_DIR, '..');

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

// Lo que la gente realmente lee. Sin esto el gate vigilaba una sola puerta.
const sup = problemasDeSuperficies(
  RAIZ_PUBLICADA,
  (d) => readdirSync(d, { withFileTypes: true }),
  (f) => readFileSync(f, 'utf8')
);
problemas.push(...sup.problemas);

// El fallback estático del banner de novedades debe decir lo mismo que news.json.
try {
  const banner = problemasDelBannerEstatico(
    readFileSync(resolve(RAIZ_PUBLICADA, 'index.html'), 'utf8'),
    JSON.parse(readFileSync(resolve(RAIZ_PUBLICADA, 'news.json'), 'utf8'))
  );
  problemas.push(...banner);
  console.log(`  banner estático de novedades: ${banner.length ? 'DESALINEADO' : 'alineado con news.json'}`);
} catch (e) {
  problemas.push(`no se pudo contrastar el banner estático: ${e.message}`);
}
console.log(
  `  superficie: ${sup.revisados} archivos publicados revisados ` +
    `(${sup.exentos} regiones no leidas por el publico quedaron fuera: ` +
    `comentarios y claves _* de mantenimiento)`
);

if (problemas.length) {
  console.error(`\n✖ Cifras fuera de contrato (${problemas.length}):`);
  for (const p of problemas.slice(0, 40)) console.error(`    - ${p}`);
  if (problemas.length > 40) console.error(`    … y ${problemas.length - 40} más`);
  console.error('\n  Dónde se arregla, según de dónde venga:');
  console.error('    · knowledge.json o un chunk → en el GENERADOR (build_web_knowledge.py),');
  console.error('      nunca a mano ni reparándolo en el navegador.');
  console.error('    · un .html/.json publicado  → en la plantilla que lo escribe.');
  console.error('  Si la cifra aparece dentro de un comentario o una clave «_*», el gate no la');
  console.error('  marca: son notas de mantenimiento que nadie pinta.');
  console.error('  Ver docs/CONTRATO_VOCABULARIO_CIFRAS.md.');
  process.exit(1);
}

console.log('\n✔ Corpus, knowledge.json y superficie publicada dentro del contrato.');
