/**
 * Vocabulario cerrado del EpiBot y de la función RAG (cuarta auditoría Codex de alta_b44, 19-nov-2026).
 *
 * Genera `js/vocab_cerrado.js` (globalThis.EPI_VOCAB_CERRADO) a partir de fuentes versionadas, nunca a mano:
 *   1. catálogo de releases (nombres, rótulos, consultas, alias, códigos) y `noModeladas` — sin filtrar;
 *   2. literales de texto cortos del catálogo y de los handlers del KB y de la función RAG (release_catalog.js, kb.js, entities.js, obesidad_kb.js,
 *      radar_boletin.js, app.js, vista_turno.mjs, vista_grounding.mjs, rag.mjs) y las consultas `data-q` de index.html;
 *   3. claves y textos cortos de knowledge.json y nombres del radar del boletín vigente;
 *   4. corpus RAG (rag_index.json): tokens presentes en al menos dos fragmentos;
 *   5. consultas de los 616 casos funcionales (tests/test_cases.json) y literales de las pruebas, salvo las de seguridad
^ *      de las auditorías Codex (test_crisis_codex_b44, test_listablanca_codex_b44, test_crisis3_codex_b44, test_vocab_codex_b44), que contienen evasiones a propósito; cada consulta que dispara la crisis se descarta
 *      entera y las demás aportan todos sus tokens;
 *   6. meses en español e inglés (Intl) y nombres de los cuatro padecimientos legacy.
 * Las fuentes 2 a 4 pasan un filtro mecánico de riesgo: se descarta todo token que, solo o en «quiero …», «me …» o «i …»,
 * dispara la respuesta de crisis del catálogo, los reflexivos ingleses (…self, …selves) y los tokens que mezclan letras y
 * dígitos fuera de la forma de un código CIE o una semana.
 *
 * Uso: node scripts/build_vocab_cerrado.mjs [--check]   (--check falla si el archivo versionado no coincide)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { createHash } from 'crypto';

const base = new URL('../', import.meta.url);
const raiz = new URL('../../', import.meta.url);
const leer = (u) => readFileSync(u, 'utf-8');
await import('../js/release_catalog.js');
const C = globalThis.EPI_CATALOGO;

const norm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (t) => norm(t).split(' ').filter(Boolean);
const forma = (w) => !/[a-z]/.test(w) || !/\d/.test(w) || /^[a-z]\d{2,3}$/.test(w) || /^w\d{1,2}$/.test(w);
const riesgo = (w) => Boolean(C.respuestaCrisis(w) || C.respuestaCrisis(`quiero ${w}`) || C.respuestaCrisis(`me ${w}`) ||
  C.respuestaCrisis(`i ${w}`) || /sel(f|ves)$/.test(w));

const fuentes = {};
const agrega = (nombre, lista, filtrar = true) => {
  const set = (fuentes[nombre] ||= new Set());
  for (const t of lista) for (const w of tokens(t)) if (forma(w) && !(filtrar && riesgo(w))) set.add(w);
};
/** Consultas completas: se descartan enteras si disparan la crisis; si no, todos sus tokens entran tal cual. */
const agregaConsultas = (nombre, lista) => {
  const set = (fuentes[nombre] ||= new Set());
  for (const q of lista) if (!C.respuestaCrisis(q)) for (const w of tokens(q)) set.add(w);
};

// 1. Catálogo, sin filtrar.
agrega('catalogo', C.releases.flatMap((r) => [r.nombre, r.etiqueta, r.pad, r.nombreCorto, r.consulta, r.consultaVisible,
  r.cie, ...(r.alias || []), ...(r.prefijos || [])]).concat(C.noModeladas), false);
agrega('legacy', ['depresion depresión parkinson alzheimer dengue F32 G20 G30 A97'], false);

// 2. Literales de los handlers y consultas del índice del EpiBot.
const literales = (src, max = 80) => [...src.matchAll(new RegExp(`'([^'\\\\\\n]{1,${max}})'|"([^"\\\\\\n]{1,${max}})"`, 'g'))]
  .map((m) => m[1] ?? m[2]);
const handlers = ['js/release_catalog.js', 'js/kb.js', 'js/entities.js', 'js/obesidad_kb.js', 'js/radar_boletin.js', 'js/app.js',
  'netlify/lib/vista_turno.mjs', 'netlify/lib/vista_grounding.mjs', 'netlify/functions/rag.mjs'];
agrega('handlers', handlers.flatMap((f) => literales(leer(new URL(f, base)))));
agregaConsultas('index_data_q', [...leer(new URL('index.html', base)).matchAll(/data-q="([^"]*)"/g)].map((m) => m[1]));

// 3. knowledge.json y radar del boletín vigente.
const textosCortos = (o, out = []) => {
  if (typeof o === 'string') { if (o.length <= 80) out.push(o); } else if (Array.isArray(o)) o.forEach((x) => textosCortos(x, out));
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { out.push(k); textosCortos(v, out); }
  return out;
};
agrega('knowledge', textosCortos(JSON.parse(leer(new URL('knowledge.json', base)))));
const actual = JSON.parse(leer(new URL('assets/boletin/actual.json', raiz)));
agrega('radar', textosCortos(JSON.parse(leer(new URL(`${actual.carpeta}/data.json`, raiz)))));

// 4. Corpus RAG: tokens en al menos dos fragmentos.
const df = new Map();
for (const c of JSON.parse(leer(new URL('rag_index.json', base))).chunks) {
  for (const w of new Set(tokens(`${c.title || ''} ${c.section || ''} ${c.text || ''}`))) df.set(w, (df.get(w) || 0) + 1);
}
agrega('corpus', [...df].filter(([, n]) => n >= 2).map(([w]) => w));

// 5. Consultas de pruebas: los 616 casos funcionales y literales de las pruebas que no son de riesgo.
agregaConsultas('casos_funcionales', JSON.parse(leer(new URL('tests/test_cases.json', base))).map((c) => c.query));
// Las pruebas de seguridad (crisis, lista blanca, vocabulario) contienen a propósito evasiones que deben quedar FUERA
// del vocabulario: no son fuente.
const SEGURIDAD = /^test_(crisis_codex_b44|listablanca_codex_b44|crisis3_codex_b44|vocab_codex_b44)\.mjs$/;
const pruebas = readdirSync(new URL('tests/', base)).filter((f) => /\.(mjs|js)$/.test(f) && !SEGURIDAD.test(f)).sort();
agregaConsultas('pruebas', pruebas.flatMap((f) => literales(leer(new URL(`tests/${f}`, base)), 400)));

// 6. Meses.
const meses = [];
for (const loc of ['es-MX', 'en-US']) for (let m = 0; m < 12; m++) meses.push(new Date(Date.UTC(2026, m, 15)).toLocaleString(loc, { month: 'long', timeZone: 'UTC' }));
agrega('meses', meses, false);

const todo = [...new Set(Object.values(fuentes).flatMap((s) => [...s]))].sort();
const resumen = Object.fromEntries(Object.entries(fuentes).map(([k, s]) => [k, s.size]));
const huella = createHash('sha256').update(todo.join('\n')).digest('hex');
const salida = `/* Generado por epibot/scripts/build_vocab_cerrado.mjs; no editar a mano. ${todo.length} tokens, sha256 ${huella}.\n` +
  ` * Tokens por fuente (con solapes): ${JSON.stringify(resumen)} */\n` +
  `globalThis.EPI_VOCAB_CERRADO = new Set(${JSON.stringify(todo)});\n`;
const destino = new URL('js/vocab_cerrado.js', base);
if (process.argv.includes('--check')) {
  const ok = existsSync(destino) && leer(destino) === salida;
  console.log(ok ? `vocab_cerrado.js reproducible (${todo.length} tokens)` : 'vocab_cerrado.js NO coincide con el generador: npm run vocab:build');
  process.exit(ok ? 0 : 1);
}
writeFileSync(destino, salida);
console.log(`vocab_cerrado.js: ${todo.length} tokens`, resumen);
