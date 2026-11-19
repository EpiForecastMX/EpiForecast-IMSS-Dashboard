/**
 * Fragmentos reconocidos del EpiBot y de la función RAG (quinta auditoría Codex de alta_b44, 19-nov-2026).
 *
 * Genera `js/vocab_cerrado.js` (globalThis.EPI_FRAGMENTOS) con las FRASES COMPLETAS que el bot reconoce y retira del turno
 * antes de comprobar el resto contra la lista curada de `js/vocab_consulta.js`:
 *   - del catálogo de releases: nombres, rótulos, consultas, alias, prefijos y códigos; y `noModeladas`;
 *   - de los cuatro padecimientos legacy (nombres y códigos);
 *   - de las categorías del radar del boletín vigente (nombres impresos);
 *   - de la geografía que ya reconoce `js/entities.js` (ESTADOS_ALIAS y ESTADOS_32).
 * Además genera EPI_TERMINOS_CLINICOS (ver abajo). Ya no deriva palabras sueltas del corpus, de `knowledge.json` ni de las pruebas: un fragmento sólo cuenta si aparece
 * COMPLETO en el turno, así que palabras como «vivo», «tomo» o «sedantes» no quedan admitidas fuera de su alias.
 *
 * Uso: node scripts/build_vocab_cerrado.mjs [--check]   (--check falla si el archivo versionado no coincide)
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';

const base = new URL('../', import.meta.url);
const raiz = new URL('../../', import.meta.url);
const leer = (u) => readFileSync(u, 'utf-8');
await import('../js/release_catalog.js');
const C = globalThis.EPI_CATALOGO;
const norm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const fuentes = {};
const agrega = (nombre, lista) => { const s = (fuentes[nombre] ||= new Set()); for (const t of lista) { const n = norm(t); if (n) s.add(n); } };

agrega('catalogo', C.releases.flatMap((r) => [r.nombre, r.etiqueta, r.pad, r.nombreCorto, r.consulta, r.cie,
  ...String(r.cie || '').split(/,\s*/), ...(r.alias || []), ...(r.prefijos || [])]));
agrega('no_modeladas', C.noModeladas);
agrega('legacy', ['depresion', 'depression', 'parkinson', 'alzheimer', 'alzaimer', 'dengue', 'f32', 'g20', 'g30', 'a97']);
const actual = JSON.parse(leer(new URL('assets/boletin/actual.json', raiz)));
agrega('radar', JSON.parse(leer(new URL(`${actual.carpeta}/data.json`, raiz))).diseases.map((d) => d.name));
const ent = leer(new URL('js/entities.js', base));
const bloque = (desde, hasta) => ent.slice(ent.indexOf(desde), ent.indexOf(hasta));
agrega('geografia', [...bloque('const ESTADOS_ALIAS', 'const ESTADOS_SORTED').matchAll(/'([^']+)':/g)].map((m) => m[1])
  .concat([...bloque('const ESTADOS_32', 'export function canonEstado').matchAll(/'([^']+)'/g)].map((m) => m[1])));

const todo = [...new Set(Object.values(fuentes).flatMap((s) => [...s]))].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
// Términos clínicos sueltos: palabras de los fragmentos de releases NO sensibles, de no modelados, del radar y de los
// legacy («crónica», «viral», «oral», «embarazo»), para que una variante clínica se reconozca aunque no sea un alias literal.
// Se excluyen las palabras de los rótulos de releases sensibles (autolesión, violencia, arma de fuego, alcohol, VIH: sólo
// cuentan dentro de su fragmento completo), los números y toda palabra que, sola o en «quiero …», «me …» o «i …», dispara
// la respuesta de crisis del catálogo.
const deSensibles = new Set(C.releases.filter((r) => C.IDS_LISTA_BLANCA.has(r.id))
  .flatMap((r) => [r.nombre, r.etiqueta, r.pad, r.nombreCorto, r.consulta, ...(r.alias || []), ...(r.prefijos || [])])
  .flatMap((t) => norm(t).split(' ')));
// Exclusión explícita (auditoría Codex): palabras de violencia, ingestión o estado vital que sólo cuentan dentro de su
// fragmento completo («golpe de calor»), aunque aparezcan en un rótulo no sensible.
const EXCLUIDOS = new Set(['golpe', 'golpes', 'golpea', 'golpeado', 'vivo', 'viva', 'vida', 'muerte', 'muerto', 'tomo', 'toma',
  'tabletas', 'pastillas', 'sedantes', 'pills', 'poison', 'veneno', 'venenoso', 'venenosa']);
// Numerales en letra (edades y cantidades): nunca son vocabulario suelto.
const NUMERALES = /^(cero|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieci\w+|veint\w*|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|doscientos|mil|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|hundred|thousand)$/;
// Estados de ánimo: nunca son vocabulario suelto.
const ANIMO = new Set(['triste', 'tristeza', 'soledad', 'desesperado', 'desesperada', 'desesperanza', 'cansado', 'cansada',
  'angustia', 'angustiado', 'angustiada', 'llorar', 'lloro', 'sad', 'lonely', 'hopeless', 'tired']);
const riesgo = (w) => EXCLUIDOS.has(w) || NUMERALES.test(w) || ANIMO.has(w) || Boolean(C.respuestaCrisis(w) || C.respuestaCrisis(`quiero ${w}`) || C.respuestaCrisis(`me ${w}`) ||
  C.respuestaCrisis(`i ${w}`));
// Términos de las guardas de alcance y de los handlers: palabras de las expresiones regulares del catálogo (subtipos,
// vecinos y nombres genéricos; se omiten las de riesgo: CRISIS, VIOLENCIA, INGESTION, RIESGO, METODO, DOSIS, INTENCION,
// MENOR, PELIGRO, AUTOLESION, SENSIBLE, EMOJI) y literales cortos de palabras clave de entities.js, kb.js y obesidad_kb.js.
const RIESGO_CONST = /\b(CRISIS|VIOLENCIA|INGESTION|RIESGO|METODO|DOSIS|INTENCION|CONSULTA_DATOS|MENOR|PELIGRO|AUTOLESION|SENSIBLE|EMOJI|CANTIDAD|FARMACO|TOXICO|SUSTANCIA)\w*\s*=/;
const guardas = [];
const prefijosGuardas = new Set();
for (const f of ['js/release_catalog.js', 'js/kb.js', 'js/entities.js', 'netlify/lib/vista_turno.mjs']) {
  for (const linea of leer(new URL(f, base)).split('\n')) {
    if (/^\s*\/\//.test(linea) || RIESGO_CONST.test(linea) || !/\\b/.test(linea)) continue;
    // Toda la línea de la expresión regular (incluye sus alternativas y comentarios en línea): «bicicletas?» admite
    // «bicicleta» y «bicicletas»; «adenovir[a-z]*» deja el prefijo «adenovir».
    for (const t of linea.replace(/\\[bdswBDSW]/g, ' ').matchAll(/([a-z]+)(\?|\[a-z\]\*|\[a-z\]\+|\\w\*|\\w\+)?/g)) {
      const [, w, suf] = t;
      if (suf === '?') guardas.push(w, w.slice(0, -1));
      else if (suf) { if (w.length >= 5) prefijosGuardas.add(w); } else guardas.push(w);
    }
  }
}
const literalesCortos = (src) => [...src.matchAll(/'([^'\\\n]{2,40})'/g)].map((m) => m[1]);
for (const f of ['js/entities.js', 'js/kb.js', 'js/obesidad_kb.js']) guardas.push(...literalesCortos(leer(new URL(f, base))));
const clinicos = [...new Set(C.releases.filter((r) => !C.IDS_LISTA_BLANCA.has(r.id))
  .flatMap((r) => [r.nombre, r.etiqueta, r.pad, r.nombreCorto, r.consulta, ...(r.alias || []), ...(r.prefijos || [])])
  .concat(C.noModeladas, [...fuentes.radar], [...fuentes.legacy], guardas)
  .flatMap((t) => norm(t).split(' ')))]
  .filter((w) => w.length > 1 && /[a-z]/.test(w) && !/\d/.test(w) && !deSensibles.has(w) && !riesgo(w) && !/sel(f|ves)$/.test(w))
  .sort();
const prefijos = [...prefijosGuardas].filter((w) => !deSensibles.has(w) && !riesgo(w) && !riesgo(`${w}ar`) &&
  !riesgo(`${w}arme`) && !riesgo(`${w}o`)).sort();
const resumen = Object.fromEntries(Object.entries(fuentes).map(([k, s]) => [k, s.size]));
const huella = createHash('sha256').update(todo.join('\n')).digest('hex');
const salida = `/* Generado por epibot/scripts/build_vocab_cerrado.mjs; no editar a mano. ${todo.length} fragmentos, sha256 ${huella}.\n` +
  ` * Fragmentos por fuente (con solapes): ${JSON.stringify(resumen)} */\n` +
  `globalThis.EPI_FRAGMENTOS = ${JSON.stringify(todo)};\n` +
  `/* ${clinicos.length} términos clínicos y de guardas sueltos (releases no sensibles, no modelados, radar, legacy, guardas de alcance y palabras clave de los handlers). */\n` +
  `globalThis.EPI_TERMINOS_CLINICOS = new Set(${JSON.stringify(clinicos)});\n` +
  `/* Prefijos de las guardas («adenovir», «neumococ»): un token que empieza así es término clínico. */\n` +
  `globalThis.EPI_PREFIJOS_CLINICOS = ${JSON.stringify(prefijos)};\n`;
const destino = new URL('js/vocab_cerrado.js', base);
if (process.argv.includes('--check')) {
  const ok = existsSync(destino) && leer(destino) === salida;
  console.log(ok ? `vocab_cerrado.js reproducible (${todo.length} fragmentos)` : 'vocab_cerrado.js NO coincide con el generador: npm run vocab:build');
  process.exit(ok ? 0 : 1);
}
writeFileSync(destino, salida);
console.log(`vocab_cerrado.js: ${todo.length} fragmentos`, resumen);
