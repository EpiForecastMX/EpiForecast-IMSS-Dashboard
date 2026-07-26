/**
 * candidate.mjs — C7.3b: lector del shard CANDIDATE que produce el compilador del repo principal.
 *
 * Un shard candidate vive fuera del sitio: `<staging>/<disease_id>/<release_id>/` con
 * `shard_manifest.json`, `web/manifest.json` y `web/series.csv`. Este módulo lo LEE y lo valida;
 * no escribe nada y no toca `knowledge.json`, `rag_index.json` ni ningún HTML publicado.
 *
 * Reglas que se imponen aquí, no en la vista:
 *  - un shard con `lifecycle != 'published'` es CANDIDATE: nunca alimenta la superficie pública;
 *  - `interval_method` debe ser `none` y los límites deben venir vacíos. Si un día llegan valores,
 *    esto falla en vez de dibujar una banda inventada.
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';

export const LIFECYCLE_PUBLISHED = 'published';
export const INTERVAL_NONE = 'none';

export class CandidateError extends Error {}

function leerJSON(ruta, etiqueta) {
  if (!existsSync(ruta)) throw new CandidateError(`${etiqueta}: no existe ${ruta}`);
  try {
    return JSON.parse(readFileSync(ruta, 'utf-8'));
  } catch (e) {
    throw new CandidateError(`${etiqueta}: JSON ilegible (${e.message})`);
  }
}

/** Parser CSV mínimo y estricto: el shard lo genera el compilador, no un humano. */
export function parseCSV(texto, etiqueta) {
  const lineas = texto.split('\n').filter((l) => l.length > 0);
  if (!lineas.length) throw new CandidateError(`${etiqueta}: CSV vacío`);
  const cabecera = lineas[0].split(',');
  return lineas.slice(1).map((linea, i) => {
    const campos = linea.split(',');
    if (campos.length !== cabecera.length) {
      throw new CandidateError(
        `${etiqueta}: fila ${i + 2} tiene ${campos.length} campos, la cabecera ${cabecera.length}`,
      );
    }
    return Object.fromEntries(cabecera.map((c, j) => [c, campos[j]]));
  });
}

/** Descubre `<staging>/<disease>/<release>` sin adivinar nombres: los lee del disco. */
export function findShards(stagingRoot) {
  if (!existsSync(stagingRoot)) return [];
  const salida = [];
  for (const disease of readdirSync(stagingRoot).sort()) {
    const dir = join(stagingRoot, disease);
    if (!existsSync(join(dir, '..'))) continue;
    let releases;
    try {
      releases = readdirSync(dir).sort();
    } catch {
      continue;
    }
    for (const release of releases) {
      if (existsSync(join(dir, release, 'shard_manifest.json'))) {
        salida.push({ diseaseId: disease, releaseId: release, root: join(dir, release) });
      }
    }
  }
  return salida;
}

/**
 * Carga y VALIDA un shard candidate.
 * @returns {{manifest:object, web:object, rows:object[], isCandidate:boolean, root:string}}
 */
export function loadCandidateShard(shardRoot) {
  const root = resolve(shardRoot);
  const manifest = leerJSON(join(root, 'shard_manifest.json'), 'shard_manifest.json');
  const web = leerJSON(join(root, 'web', 'manifest.json'), 'web/manifest.json');

  for (const [clave, valor] of [
    ['release_id', manifest.release_id],
    ['disease_id', manifest.disease_id],
    ['lifecycle', manifest.lifecycle],
  ]) {
    if (typeof valor !== 'string' || !valor.trim()) {
      throw new CandidateError(`shard_manifest.json: ${clave} ausente o vacío`);
    }
  }
  if (web.release_id !== manifest.release_id) {
    throw new CandidateError(
      `web/manifest.json describe ${web.release_id}, el shard declara ${manifest.release_id}`,
    );
  }
  if (manifest.interval_method !== INTERVAL_NONE || manifest.uncertainty_available !== false) {
    throw new CandidateError(
      `${manifest.disease_id}: el shard declara incertidumbre; esta vista es point-only`,
    );
  }

  const seriesPath = join(root, 'web', 'series.csv');
  if (!existsSync(seriesPath)) throw new CandidateError('web/series.csv: no existe');
  const rows = parseCSV(readFileSync(seriesPath, 'utf-8'), 'web/series.csv');
  if (rows.length !== manifest.rows) {
    throw new CandidateError(
      `web/series.csv tiene ${rows.length} filas y el manifiesto declara ${manifest.rows}`,
    );
  }
  for (const fila of rows) {
    if (fila.yhat_lower !== '' || fila.yhat_upper !== '') {
      throw new CandidateError(
        `${manifest.disease_id}: una fila trae límites de intervalo y el release es point-only`,
      );
    }
  }

  return {
    root,
    manifest,
    web,
    rows,
    isCandidate: manifest.lifecycle !== LIFECYCLE_PUBLISHED,
  };
}
