/**
 * installer.mjs — C7.6-ADAPTERS-A: instalador GENÉRICO de un shard de release.
 *
 * El compilador del backend produce un shard; alguien tiene que colocarlo donde los consumidores lo
 * leen. Ese «alguien» es esto, y no un `cp` a mano: copiar sin contrato es como se publica una cifra
 * sin su condición, o se pisa un archivo que nadie declaró.
 *
 * Reglas del contrato `publication_install.v1`:
 *  - `candidate` acepta `lifecycle=trained` y escribe SÓLO bajo la raíz que se le inyecte;
 *  - `public` exige `published` **y** un puntero activo al mismo release; sin eso falla cerrado;
 *  - reejecutar es idempotente: mismos bytes, mismo manifiesto;
 *  - un archivo previo que no esté en el inventario no se borra ni se sobrescribe;
 *  - si algo falla antes de terminar, el destino previo queda intacto (se escribe en un temporal
 *    hermano y se mueve al final).
 *
 * Ni un padecimiento, ni un `release_id`, ni un conteo escritos aquí: todo sale del shard.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { dirname, join, relative, resolve } from 'path';

import { CandidateError, loadCandidateShard } from './candidate.mjs';

export const INSTALL_SCHEMA = 'publication_install.v1';
export const MODE_CANDIDATE = 'candidate';
export const MODE_PUBLIC = 'public';
export const LIFECYCLE_PUBLISHED = 'published';
export const CATALOG_FILE = 'publication/catalog.json';
export const INSTALL_MANIFEST = 'publication_install.json';

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** Archivos del shard que consume el instalador → ruta relativa de destino. */
function planDeArchivos(diseaseId, releaseId) {
  const base = `${diseaseId}/${releaseId}`;
  return [
    { desde: 'web/manifest.json', hacia: `publication/${base}/manifest.json`, canal: 'web' },
    { desde: 'web/series.csv', hacia: `publication/${base}/series.csv`, canal: 'web' },
    { desde: 'reports/report.md', hacia: `Reports/publication/${base}/report.md`, canal: 'reports' },
    {
      desde: 'reports/forecast_products.csv',
      hacia: `Reports/publication/${base}/forecast_products.csv`,
      canal: 'reports',
    },
    { desde: 'epibot/knowledge.json', hacia: `publication/${base}/knowledge.json`, canal: 'epibot' },
    {
      desde: `epibot/corpus/${diseaseId}.md`,
      hacia: `publication/${base}/corpus/${diseaseId}.md`,
      canal: 'epibot',
    },
  ];
}

function leerJSON(ruta, etiqueta) {
  try {
    return JSON.parse(readFileSync(ruta, 'utf-8'));
  } catch (e) {
    throw new CandidateError(`${etiqueta}: JSON ilegible (${e.message})`);
  }
}

/**
 * Catálogo de releases instalados. Es lo que una vista consulta para saber qué hay y en qué estado;
 * un candidate figura con `visible: false` y ninguna vista pública debe listarlo.
 */
function actualizarCatalogo(root, entrada) {
  const ruta = join(root, CATALOG_FILE);
  const previo = existsSync(ruta) ? leerJSON(ruta, CATALOG_FILE) : { schema: INSTALL_SCHEMA, releases: [] };
  const otros = (previo.releases || []).filter(
    (r) => !(r.disease_id === entrada.disease_id && r.release_id === entrada.release_id),
  );
  // Upsert por (disease_id, release_id): ni concatenar —duplicaría— ni sobrescribir el catálogo
  // entero —borraría los releases de otros padecimientos—.
  const releases = [...otros, entrada].sort((a, b) =>
    `${a.disease_id}/${a.release_id}`.localeCompare(`${b.disease_id}/${b.release_id}`),
  );
  return { ruta, contenido: { schema: INSTALL_SCHEMA, releases } };
}

/** JSON canónico: claves ordenadas y sin espacios, para que reinstalar dé los MISMOS bytes. */
function canonical(valor) {
  if (Array.isArray(valor)) return `[${valor.map(canonical).join(',')}]`;
  if (valor && typeof valor === 'object') {
    return `{${Object.keys(valor)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(valor[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(valor);
}

/**
 * Instala un shard bajo `targetRoot`.
 *
 * @param {string} shardRoot  raíz del shard compilado (`<staging>/<disease>/<release>`)
 * @param {string} targetRoot raíz de instalación; en candidate DEBE ser un temporal externo
 * @param {{mode?:string, pointerReleaseId?:string|null}} opciones
 */
export function installShard(shardRoot, targetRoot, { mode = MODE_CANDIDATE, pointerReleaseId = null } = {}) {
  if (![MODE_CANDIDATE, MODE_PUBLIC].includes(mode)) {
    throw new CandidateError(`modo de instalación desconocido: ${JSON.stringify(mode)}`);
  }
  const shard = loadCandidateShard(shardRoot);
  const { manifest, status } = shard;
  const publicado = manifest.lifecycle === LIFECYCLE_PUBLISHED;

  if (mode === MODE_PUBLIC) {
    if (!publicado) {
      throw new CandidateError(
        `${manifest.disease_id}: el modo public exige lifecycle ${LIFECYCLE_PUBLISHED}, no ${manifest.lifecycle}`,
      );
    }
    if (pointerReleaseId !== manifest.release_id) {
      throw new CandidateError(
        `${manifest.disease_id}: el modo public exige un puntero activo a ${manifest.release_id}`,
      );
    }
  }

  const root = resolve(targetRoot);
  const plan = planDeArchivos(manifest.disease_id, manifest.release_id);
  const inputs = {};
  const outputs = {};

  // Se escribe primero en un temporal HERMANO: si algo falla a mitad, el destino previo no queda
  // con la mitad de una instalación.
  const staging = `${root}.installing`;
  rmSync(staging, { recursive: true, force: true });
  try {
    for (const { desde, hacia } of plan) {
      const origen = join(shardRoot, desde);
      if (!existsSync(origen)) throw new CandidateError(`el shard no trae ${desde}`);
      const datos = readFileSync(origen);
      inputs[desde] = sha256(datos);
      const destino = join(staging, hacia);
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, datos);
      outputs[hacia] = sha256(datos);
    }

    const entrada = {
      disease_id: manifest.disease_id,
      release_id: manifest.release_id,
      lifecycle: manifest.lifecycle,
      mode,
      channels: [...new Set(plan.map((p) => p.canal))].sort(),
      publication_label: shard.label,
      verdict: status.verdict,
      weeks_available: status.weeks_available,
      weeks_required: status.weeks_required,
      gate_digest: status.gate_digest,
      evaluation_digest: status.evaluation_digest,
      status_digest: status.status_digest,
      // Un candidate NUNCA es visible: la vista pública filtra por esto, no por el nombre.
      visible: mode === MODE_PUBLIC && publicado,
      paths: Object.keys(outputs).sort(),
    };

    const manifiesto = {
      schema: INSTALL_SCHEMA,
      shard_schema: manifest.schema,
      mode,
      disease_id: manifest.disease_id,
      release_id: manifest.release_id,
      lifecycle: manifest.lifecycle,
      channels: entrada.channels,
      publication_label: shard.label,
      publication_status: status,
      inputs: Object.fromEntries(Object.keys(inputs).sort().map((k) => [k, inputs[k]])),
      outputs: Object.fromEntries(Object.keys(outputs).sort().map((k) => [k, outputs[k]])),
    };
    const rutaManifiesto = join(
      staging,
      `publication/${manifest.disease_id}/${manifest.release_id}/${INSTALL_MANIFEST}`,
    );
    mkdirSync(dirname(rutaManifiesto), { recursive: true });
    writeFileSync(rutaManifiesto, canonical(manifiesto));

    // El catálogo se calcula sobre el que YA existe en el destino, no sobre el temporal.
    const catalogo = actualizarCatalogo(root, entrada);
    mkdirSync(dirname(join(staging, CATALOG_FILE)), { recursive: true });
    writeFileSync(join(staging, CATALOG_FILE), canonical(catalogo.contenido));

    // Nada de borrar el destino: se fusiona archivo a archivo, y sólo los del inventario.
    mkdirSync(root, { recursive: true });
    for (const relativa of [...Object.keys(outputs), `publication/${manifest.disease_id}/${manifest.release_id}/${INSTALL_MANIFEST}`, CATALOG_FILE]) {
      const desde = join(staging, relativa);
      const hacia = join(root, relativa);
      mkdirSync(dirname(hacia), { recursive: true });
      cpSync(desde, hacia);
    }
    return { root, manifest: manifiesto, catalog: catalogo.contenido, files: Object.keys(outputs).sort() };
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

/** Lee el catálogo instalado. Sin catálogo no hay releases: no se adivina por directorio. */
export function readCatalog(targetRoot) {
  const ruta = join(resolve(targetRoot), CATALOG_FILE);
  if (!existsSync(ruta)) return { schema: INSTALL_SCHEMA, releases: [] };
  const datos = leerJSON(ruta, CATALOG_FILE);
  if (datos.schema !== INSTALL_SCHEMA) {
    throw new CandidateError(`${CATALOG_FILE}: schema ${JSON.stringify(datos.schema)} no soportado`);
  }
  return datos;
}

/** Inventario de rutas instaladas bajo la raíz, para comparar dos instalaciones. */
export function inventory(targetRoot) {
  const root = resolve(targetRoot);
  const salida = {};
  const caminar = (dir) => {
    for (const nombre of readdirSync(dir).sort()) {
      const p = join(dir, nombre);
      if (statSync(p).isDirectory()) caminar(p);
      else salida[relative(root, p)] = sha256(readFileSync(p));
    }
  };
  if (existsSync(root)) caminar(root);
  return salida;
}
