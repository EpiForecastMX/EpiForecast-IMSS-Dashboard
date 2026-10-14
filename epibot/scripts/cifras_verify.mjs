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
import { existsSync, readFileSync, readdirSync } from 'fs';
import { buildChunks, KB_DIR } from './lib/corpus.mjs';
import {
  problemasDeCifras,
  problemasDeKnowledge,
  problemasDelBannerEstatico,
  problemasDeDistribuciones,
  problemasDeSuperficies,
  problemasDeMetricasSeleccion,
  problemasDeMetricasEnPagina,
  problemasDeGaleria,
  problemasDeMetricasAntiguas,
  problemasDeNoticias,
  problemasDeSeguimientoSemanal,
  problemasDeNacionalPorSexo,
  problemasDeVistasSeguimiento,
  VISTAS_SEGUIMIENTO,
  PAGINAS_METRICAS_ANTIGUAS,
  PAGINAS_OPERATIVAS,
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

// Métricas de selección W28–W37 retiradas: ni en knowledge.json ni en las vistas operativas.
if (kb) {
  const pm = problemasDeMetricasSeleccion(kb);
  problemas.push(...pm);
  console.log(`  métricas de selección en knowledge.json: ${pm.length ? `${pm.length} PUBLICADAS` : 'retiradas y declaradas'}`);
}
{
  let nPag = 0;
  for (const rel of PAGINAS_OPERATIVAS) {
    let html;
    try {
      html = readFileSync(resolve(RAIZ_PUBLICADA, rel), 'utf8');
    } catch (e) {
      problemas.push(`no se pudo leer ${rel}: ${e.message}`);
      continue;
    }
    const p = problemasDeMetricasEnPagina(rel, html);
    nPag += p.length;
    problemas.push(...p);
  }
  console.log(`  métricas de selección en ${PAGINAS_OPERATIVAS.length} vistas operativas: ${nPag ? `${nPag} PINTADAS` : 'ninguna'}`);
}

// La galería: la lista `DATA` que pinta las tarjetas, contada y contrastada con sus PNG.
try {
  const g = problemasDeGaleria(
    readFileSync(resolve(RAIZ_PUBLICADA, 'Reports/index.html'), 'utf8'),
    kb,
    (rel) => existsSync(resolve(RAIZ_PUBLICADA, 'Reports', rel))
  );
  problemas.push(...g.problemas);
  console.log(`  galería: ${g.total} gráficos ${JSON.stringify(g.conteo)}${g.problemas.length ? ` — ${g.problemas.length} PROBLEMAS` : ''}`);
} catch (e) {
  problemas.push(`no se pudo revisar la galería: ${e.message}`);
}

// Métricas y afirmaciones de desempeño de rondas anteriores (otro origen, no W28–W37).
{
  let n = 0;
  for (const rel of PAGINAS_METRICAS_ANTIGUAS) {
    let html;
    try {
      html = readFileSync(resolve(RAIZ_PUBLICADA, rel), 'utf8');
    } catch (e) {
      problemas.push(`no se pudo leer ${rel}: ${e.message}`);
      continue;
    }
    const p = problemasDeMetricasAntiguas(rel, html);
    n += p.length;
    problemas.push(...p);
  }
  try {
    const p = problemasDeNoticias(JSON.parse(readFileSync(resolve(RAIZ_PUBLICADA, 'news.json'), 'utf8')));
    n += p.length;
    problemas.push(...p);
  } catch (e) {
    problemas.push(`no se pudo revisar news.json: ${e.message}`);
  }
  console.log(`  métricas antiguas en ${PAGINAS_METRICAS_ANTIGUAS.length} páginas y news.json: ${n ? `${n} PUBLICADAS` : 'retiradas'}`);
}

// Seguimiento del pronóstico con corte (ronda W37): la tabla del EpiBot sin ajuste dentro de
// muestra, con el periodo oficial y los ausentes ausentes; el nacional por sexo rotulado como
// incremento neto del acumulado; las vistas sin la mezcla anterior ni calificaciones automáticas.
{
  const p = kb ? [...problemasDeSeguimientoSemanal(kb), ...problemasDeNacionalPorSexo(kb)] : [];
  for (const rel of VISTAS_SEGUIMIENTO) {
    try {
      p.push(...problemasDeVistasSeguimiento(rel, readFileSync(resolve(RAIZ_PUBLICADA, rel), 'utf8')));
    } catch (e) {
      p.push(`no se pudo leer ${rel}: ${e.message}`);
    }
  }
  problemas.push(...p);
  console.log(`  seguimiento con corte (tabla del EpiBot, nacional por sexo, ${VISTAS_SEGUIMIENTO.length} vistas): ${p.length ? `${p.length} PROBLEMAS` : 'sin ajuste presentado como validación ni calificaciones'}`);
}

// Lo que la gente realmente lee. Sin esto el gate vigilaba una sola puerta.
const sup = problemasDeSuperficies(
  RAIZ_PUBLICADA,
  (d) => readdirSync(d, { withFileTypes: true }),
  (f) => readFileSync(f, 'utf8')
);
problemas.push(...sup.problemas);

// Las distribuciones de motores escritas a mano en las páginas deben coincidir con knowledge.json.
if (kb) {
  let nDist = 0;
  for (const e of readdirSync(RAIZ_PUBLICADA, { withFileTypes: true })) {
    if (!e.isFile() || !e.name.endsWith('.html')) continue;
    const html = readFileSync(resolve(RAIZ_PUBLICADA, e.name), 'utf8');
    const p = problemasDeDistribuciones(e.name, html, kb);
    nDist += p.length;
    problemas.push(...p);
  }
  console.log(`  distribuciones de motores en páginas: ${nDist ? `${nDist} DESALINEADAS` : 'alineadas con knowledge.json'}`);
}

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
