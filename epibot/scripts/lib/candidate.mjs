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
/**
 * Schema del shard que este lector sabe interpretar. Lo emite el compilador del repo principal.
 *
 * Comprobarlo NO es ceremonia: productor y consumidor viven en repositorios distintos, evolucionan
 * en commits distintos y se revisan por separado. Sin esta igualdad, un cambio de formato se
 * descubriría como un error confuso aguas abajo —o peor, leyendo mal en silencio— en vez de decir
 * "este shard es de otra versión".
 */
export const SHARD_SCHEMA = 'publication_shard.v1';
/** Schema del bloque de estado prospectivo que transporta el shard (lo produce el backend). */
export const PROSPECTIVE_STATUS_SCHEMA = 'prospective_status.v2';
export const VERDICTS = ['INCOMPLETE', 'PASS', 'FAIL'];
const SHA256 = /^[0-9a-f]{64}$/;

export class CandidateError extends Error {}

const esEnteroEstricto = (v) => Number.isInteger(v) && typeof v === 'number' && typeof v !== 'boolean';

function periodo(valor, etiqueta) {
  if (!Array.isArray(valor) || valor.length !== 2) {
    throw new CandidateError(`${etiqueta}: se esperaba [epi_year, epi_week], no ${JSON.stringify(valor)}`);
  }
  const [anio, semana] = valor;
  if (!esEnteroEstricto(anio) || !esEnteroEstricto(semana)) {
    throw new CandidateError(`${etiqueta}: año y semana deben ser enteros`);
  }
  // 53 semanas es legítimo: hay años MMWR de 53. Más, no existe en ningún calendario.
  if (anio < 1900 || anio > 2200 || semana < 1 || semana > 53) {
    throw new CandidateError(`${etiqueta}: periodo fuera de rango (${anio}-W${semana})`);
  }
  return `${anio}-${String(semana).padStart(2, '0')}`;
}

function periodos(lista, etiqueta) {
  if (!Array.isArray(lista)) throw new CandidateError(`${etiqueta}: se esperaba una lista`);
  const claves = lista.map((p, i) => periodo(p, `${etiqueta}[${i}]`));
  if (new Set(claves).size !== claves.length) {
    throw new CandidateError(`${etiqueta}: hay periodos repetidos`);
  }
  return claves;
}

/**
 * Valida el bloque `publication_status` que viaja EN EL SHARD.
 *
 * El dashboard no recalcula el gate ni lee los JSON privados del backend: valida el CONTRATO
 * transportado. Sin esto, la etiqueta que ve el usuario sería texto sin nada que la respalde, y una
 * incoherencia entre productor y consumidor —que viven en repos distintos— pasaría desapercibida.
 */
export function checkPublicationStatus(bloque, etiqueta) {
  if (!bloque || typeof bloque !== 'object' || Array.isArray(bloque)) {
    throw new CandidateError(`${etiqueta}: falta el bloque publication_status`);
  }
  if (bloque.schema !== PROSPECTIVE_STATUS_SCHEMA) {
    throw new CandidateError(
      `${etiqueta}: schema ${JSON.stringify(bloque.schema)} no soportado ` +
        `(este lector entiende ${JSON.stringify(PROSPECTIVE_STATUS_SCHEMA)})`,
    );
  }
  for (const clave of ['gate_digest', 'evaluation_digest', 'status_digest']) {
    if (typeof bloque[clave] !== 'string' || !SHA256.test(bloque[clave])) {
      throw new CandidateError(`${etiqueta}: ${clave} no es un SHA256 de 64 hex minúsculas`);
    }
  }
  for (const clave of ['observation_dataset_id', 'label']) {
    if (typeof bloque[clave] !== 'string' || !bloque[clave].trim()) {
      throw new CandidateError(`${etiqueta}: ${clave} ausente o vacío`);
    }
  }
  if (!VERDICTS.includes(bloque.verdict)) {
    throw new CandidateError(
      `${etiqueta}: verdict ${JSON.stringify(bloque.verdict)} desconocido (${VERDICTS.join('/')})`,
    );
  }
  for (const clave of ['weeks_available', 'weeks_required']) {
    if (!esEnteroEstricto(bloque[clave])) {
      throw new CandidateError(`${etiqueta}: ${clave} debe ser un entero`);
    }
  }
  const { weeks_available: disponibles, weeks_required: requeridas } = bloque;
  if (requeridas <= 0 || disponibles < 0 || disponibles > requeridas) {
    throw new CandidateError(
      `${etiqueta}: conteo fuera de rango (${disponibles}/${requeridas})`,
    );
  }
  const completadas = periodos(bloque.completed_weeks, `${etiqueta}: completed_weeks`);
  const objetivo = periodos(bloque.target_weeks, `${etiqueta}: target_weeks`);
  if (completadas.length !== disponibles) {
    throw new CandidateError(
      `${etiqueta}: completed_weeks tiene ${completadas.length} y declara ${disponibles}`,
    );
  }
  if (objetivo.length !== requeridas) {
    throw new CandidateError(
      `${etiqueta}: target_weeks tiene ${objetivo.length} y declara ${requeridas}`,
    );
  }
  const ordenadas = [...completadas].sort();
  if (ordenadas.join('|') !== completadas.join('|')) {
    throw new CandidateError(`${etiqueta}: completed_weeks debe ir en orden cronológico`);
  }
  // Una semana completada anterior al inicio del gate no pertenece a esta validación.
  if (completadas.length && objetivo.length && completadas[0] < objetivo[0]) {
    throw new CandidateError(
      `${etiqueta}: hay semanas completadas anteriores a la primera semana objetivo`,
    );
  }
  const completo = disponibles === requeridas;
  if (bloque.verdict === 'INCOMPLETE' && completo) {
    throw new CandidateError(`${etiqueta}: INCOMPLETE con todas las semanas disponibles`);
  }
  if (bloque.verdict !== 'INCOMPLETE' && !completo) {
    throw new CandidateError(
      `${etiqueta}: ${bloque.verdict} exige las ${requeridas} semanas, hay ${disponibles}`,
    );
  }
  return bloque;
}

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

  if (manifest.schema !== SHARD_SCHEMA) {
    throw new CandidateError(
      `shard_manifest.json: schema ${JSON.stringify(manifest.schema)} no soportado ` +
        `(este lector entiende ${JSON.stringify(SHARD_SCHEMA)})`,
    );
  }
  if (web.schema !== SHARD_SCHEMA) {
    throw new CandidateError(
      `web/manifest.json: schema ${JSON.stringify(web.schema)} no soportado ` +
        `(este lector entiende ${JSON.stringify(SHARD_SCHEMA)})`,
    );
  }

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

  // Estado prospectivo: obligatorio, validado y COHERENTE entre los dos manifiestos. Que el shard
  // lo traiga por duplicado no es redundancia inútil: cada canal lee el suyo, y si divergen el
  // usuario vería dos condiciones distintas para el mismo dato.
  const status = checkPublicationStatus(manifest.publication_status, 'shard_manifest.json');
  const statusWeb = checkPublicationStatus(web.publication_status, 'web/manifest.json');
  if (JSON.stringify(status) !== JSON.stringify(statusWeb)) {
    throw new CandidateError(
      'publication_status difiere entre shard_manifest.json y web/manifest.json',
    );
  }
  for (const [etiqueta, fuente] of [
    ['shard_manifest.json', manifest],
    ['web/manifest.json', web],
  ]) {
    if (fuente.publication_label !== status.label) {
      throw new CandidateError(
        `${etiqueta}: publication_label no coincide con publication_status.label`,
      );
    }
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
    status,
    label: status.label,
    isCandidate: manifest.lifecycle !== LIFECYCLE_PUBLISHED,
  };
}
