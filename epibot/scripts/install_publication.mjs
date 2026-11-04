/**
 * install_publication.mjs — C7.7: instala en el SITIO un release publicado del backend.
 *
 * Es el borde que faltaba entre el compilador público del backend y los consumidores del sitio:
 *
 *  1. lee el puntero ACTIVO del backend (`public_release_pointer.v1`) y exige `active=true`;
 *  2. instala el shard en modo `public` con `installShard` (verifica cada archivo contra su
 *     manifiesto, exige `lifecycle=published` y que el puntero apunte al mismo release, y escribe
 *     `publication/catalog.json` al final como único commit visible);
 *  3. registra el puntero en `publication/pointers.json`, que es lo que leen el índice RAG, su
 *     verificación y el contrato de cifras para incluir el release;
 *  4. copia la vista derivada (`publication_view.v1`: observado + pronóstico + desempeño) a
 *     `publication/<id>/vista.json`, tras comprobar que describe EXACTAMENTE ese shard.
 *
 * Uso (desde epibot/):
 *   node scripts/install_publication.mjs --shard <dir> --pointer <puntero.json> --vista <vista.json>
 *        [--root <raíz del sitio>]
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

import { CandidateError } from './lib/candidate.mjs';
import { MODE_PUBLIC, installShard } from './lib/installer.mjs';

export const POINTERS_FILE = 'publication/pointers.json';
export const POINTERS_SCHEMA = 'publication_pointers.v1';
export const POINTER_SCHEMA = 'public_release_pointer.v1';
export const VIEW_SCHEMA = 'publication_view.v1';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(__dirname, '..', '..');

function leer(ruta, que) {
  try {
    return JSON.parse(readFileSync(ruta, 'utf-8'));
  } catch (e) {
    throw new CandidateError(`${que} ilegible (${ruta}): ${e.message}`);
  }
}

function escribirAtomico(ruta, texto) {
  mkdirSync(dirname(ruta), { recursive: true });
  const tmp = `${ruta}.tmp`;
  writeFileSync(tmp, texto);
  renameSync(tmp, ruta);
}

function ordenar(valor) {
  if (Array.isArray(valor)) return valor.map(ordenar);
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(Object.keys(valor).sort().map((k) => [k, ordenar(valor[k])]));
  }
  return valor;
}

const canonical = (obj) => JSON.stringify(ordenar(obj)) + '\n';

/** Punteros públicos instalados: `{disease_id: release_id}`. Vacío si no hay ninguno. */
export function readPointers(root = SITE_ROOT) {
  const ruta = join(resolve(root), POINTERS_FILE);
  if (!existsSync(ruta)) return {};
  const datos = leer(ruta, POINTERS_FILE);
  if (datos.schema !== POINTERS_SCHEMA || typeof datos.pointers !== 'object' || !datos.pointers) {
    throw new CandidateError(`${POINTERS_FILE}: forma inválida`);
  }
  return { ...datos.pointers };
}

export function installPublication({ shard, pointer, vista, root = SITE_ROOT }) {
  const p = leer(pointer, 'puntero público');
  if (p.schema !== POINTER_SCHEMA) throw new CandidateError(`puntero: schema ${p.schema}`);
  if (p.active !== true) throw new CandidateError(`${p.disease_id}: el puntero no está activo`);

  const v = leer(vista, 'vista pública');
  const manifiesto = leer(join(shard, 'shard_manifest.json'), 'shard_manifest.json');
  if (v.schema !== VIEW_SCHEMA) throw new CandidateError(`vista: schema ${v.schema}`);
  if (v.disease_id !== p.disease_id || v.release_id !== p.release_id) {
    throw new CandidateError('vista: no describe el release del puntero');
  }
  if (JSON.stringify(v.shard_manifest_files) !== JSON.stringify(manifiesto.files)) {
    throw new CandidateError('vista: no se derivó de este shard (archivos distintos)');
  }

  const instalado = installShard(shard, root, { mode: MODE_PUBLIC, pointerReleaseId: p.release_id });

  const punteros = { ...readPointers(root), [p.disease_id]: p.release_id };
  escribirAtomico(join(resolve(root), POINTERS_FILE), canonical({ schema: POINTERS_SCHEMA, pointers: Object.fromEntries(Object.entries(punteros).sort()) }));
  escribirAtomico(join(resolve(root), 'publication', p.disease_id, 'vista.json'), readFileSync(vista, 'utf-8'));
  return { disease_id: p.disease_id, release_id: p.release_id, files: instalado.files, pointers: punteros };
}

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    if (!k.startsWith('--') || argv[i + 1] === undefined) throw new CandidateError(`argumento inválido: ${k}`);
    out[k.slice(2)] = argv[i + 1];
  }
  for (const req of ['shard', 'pointer', 'vista']) {
    if (!out[req]) throw new CandidateError(`falta --${req}`);
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const a = args(process.argv.slice(2));
    const r = installPublication({ shard: resolve(a.shard), pointer: resolve(a.pointer), vista: resolve(a.vista), root: a.root ? resolve(a.root) : SITE_ROOT });
    console.log(JSON.stringify(r));
  } catch (e) {
    console.error(`ERROR: install_publication: ${e.message}`);
    process.exit(1);
  }
}
