/**
 * Fragmentos reconocidos del EpiBot y de la función RAG (quinta auditoría Codex de alta_b44, 19-nov-2026).
 *
 * Genera `js/vocab_cerrado.js` (globalThis.EPI_FRAGMENTOS) con las FRASES COMPLETAS que el bot reconoce y retira del turno
 * antes de comprobar el resto contra la lista curada de `js/vocab_consulta.js`:
 *   - del catálogo de releases: nombres, rótulos, consultas, alias, prefijos y códigos; y `noModeladas`;
 *   - de los cuatro padecimientos legacy (nombres y códigos);
 *   - de las categorías del radar del boletín vigente (nombres impresos y su primera palabra, como el handler del radar);
 *   - de la geografía que ya reconoce `js/entities.js` (ESTADOS_ALIAS y ESTADOS_32).
 * Sexta auditoría: sólo fragmentos completos, nunca palabras sueltas. No deriva palabras del corpus, de `knowledge.json` ni de las pruebas: un fragmento sólo cuenta si aparece
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
const radar = JSON.parse(leer(new URL(`${actual.carpeta}/data.json`, raiz))).diseases.map((d) => d.name);
agrega('radar', radar);
// Cabeza del nombre impreso de cada categoría del radar («leishmaniasis», «rubéola»): el handler del radar la reconoce por
// su primera palabra. Se omite la que, sola o tras «me»/«quiero», dispara la crisis.
agrega('radar_cabeza', radar.map((n) => norm(n).split(' ')[0]).filter((w) => w.length >= 5 &&
  !C.respuestaCrisis(w) && !C.respuestaCrisis(`me ${w}`) && !C.respuestaCrisis(`quiero ${w}`)));
const ent = leer(new URL('js/entities.js', base));
const bloque = (desde, hasta) => ent.slice(ent.indexOf(desde), ent.indexOf(hasta));
agrega('geografia', [...bloque('const ESTADOS_ALIAS', 'const ESTADOS_SORTED').matchAll(/'([^']+)':/g)].map((m) => m[1])
  .concat([...bloque('const ESTADOS_32', 'export function canonEstado').matchAll(/'([^']+)'/g)].map((m) => m[1])));

const todo = [...new Set(Object.values(fuentes).flatMap((s) => [...s]))].sort((a, b) => b.length - a.length || (a < b ? -1 : 1));
const resumen = Object.fromEntries(Object.entries(fuentes).map(([k, s]) => [k, s.size]));
const huella = createHash('sha256').update(todo.join('\n')).digest('hex');
const salida = `/* Generado por epibot/scripts/build_vocab_cerrado.mjs; no editar a mano. ${todo.length} fragmentos, sha256 ${huella}.\n` +
  ` * Fragmentos por fuente (con solapes): ${JSON.stringify(resumen)} */\n` +
  `globalThis.EPI_FRAGMENTOS = ${JSON.stringify(todo)};\n`;
const destino = new URL('js/vocab_cerrado.js', base);
if (process.argv.includes('--check')) {
  const ok = existsSync(destino) && leer(destino) === salida;
  console.log(ok ? `vocab_cerrado.js reproducible (${todo.length} fragmentos)` : 'vocab_cerrado.js NO coincide con el generador: npm run vocab:build');
  process.exit(ok ? 0 : 1);
}
writeFileSync(destino, salida);
console.log(`vocab_cerrado.js: ${todo.length} fragmentos`, resumen);
