/**
 * installer.mjs — C7.6-ADAPTERS-A: instalador GENÉRICO de un shard de release.
 *
 * El compilador del backend produce un shard; alguien tiene que colocarlo donde los consumidores lo
 * leen. Ese «alguien» es esto, y no un `cp` a mano: copiar sin contrato es como se publica una cifra
 * sin su condición, o se pisa un archivo que nadie declaró.
 *
 * Reglas del contrato `publication_install.v1`:
 *  - los seis archivos del shard se verifican contra `shard_manifest.json.files` **antes** de
 *    preparar nada: un byte alterado en origen no llega al destino;
 *  - `candidate` acepta `lifecycle=trained` y escribe SÓLO bajo la raíz que se le inyecte;
 *  - `public` exige `published` **y** un puntero activo al mismo release; sin eso falla cerrado;
 *  - el directorio del release es **inmutable**: una ruta ya existente con bytes distintos se
 *    RECHAZA, nunca se sobrescribe; con los mismos bytes, reinstalar no escribe;
 *  - `publication/catalog.json` es el **único commit visible**, y se escribe al final con temporal +
 *    rename dentro de su propio directorio. Si algo falla antes, el catálogo y el release que ya era
 *    visible quedan byte-idénticos, y lo que hubiera quedado a medio instalar no lo referencia nadie.
 *
 * Por qué no un temporal hermano de la raíz entera: `cpSync` archivo a archivo sobre el árbol vivo
 * puede fallar a la mitad y dejar media instalación referenciable (R96-P0-1). El orden correcto es
 * al revés — instalar contenido que todavía nadie mira, y publicar el índice de golpe.
 *
 * Las escrituras del destino vivo pasan por `ops` para poder inyectarles fallo en las pruebas: la
 * recuperabilidad no se afirma, se prueba.
 *
 * Ni un padecimiento, ni un `release_id`, ni un conteo escritos aquí: todo sale del shard.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { dirname, join, relative, resolve } from 'path';

import { CandidateError, LIFECYCLE_PUBLISHED, checkPublicationStatus, loadCandidateShard } from './candidate.mjs';

export { LIFECYCLE_PUBLISHED };
export const INSTALL_SCHEMA = 'publication_install.v1';
export const MODE_CANDIDATE = 'candidate';
export const MODE_PUBLIC = 'public';
export const CATALOG_FILE = 'publication/catalog.json';
export const INSTALL_MANIFEST = 'publication_install.json';

/** Forma CERRADA del manifiesto de instalación. Ni una clave más, ni una menos. */
export const INSTALL_KEYS = [
  'channels',
  'disease_id',
  'gallery_enabled',
  'inputs',
  'lifecycle',
  'mode',
  'outputs',
  'publication_label',
  'publication_status',
  'release_id',
  'schema',
  'shard_schema',
];

/** Forma CERRADA de una entrada del catálogo. Una entrada a mano e incompleta se rechaza. */
export const CATALOG_ENTRY_KEYS = [
  'channels',
  'disease_id',
  'evaluation_digest',
  'gallery_enabled',
  'gate_digest',
  'lifecycle',
  'mode',
  'paths',
  'publication_label',
  'release_id',
  'status_digest',
  'verdict',
  'visible',
  'weeks_available',
  'weeks_required',
];

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/**
 * Orden BINARIO por bytes UTF-8, independiente del locale.
 *
 * `localeCompare` ordena según el ICU de la máquina: la misma instalación hecha en dos equipos con
 * `LANG` distinto producía catálogos con las entradas en otro orden y, por tanto, otros bytes
 * (R96-P1-2). El orden de un artefacto tiene que ser una propiedad del contenido, no del entorno.
 */
export function porBytes(a, b) {
  return Buffer.compare(Buffer.from(String(a), 'utf-8'), Buffer.from(String(b), 'utf-8'));
}

const claveRelease = (r) => `${r.disease_id}/${r.release_id}`;

/** Operaciones sobre el destino VIVO. Se inyectan para poder probar el fallo en cada frontera. */
export const FS_OPS = {
  mkdir: (dir) => mkdirSync(dir, { recursive: true }),
  write: (ruta, datos) => writeFileSync(ruta, datos),
  rename: (desde, hacia) => renameSync(desde, hacia),
  remove: (ruta) => rmSync(ruta, { force: true }),
};

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
  if (!existsSync(ruta)) throw new CandidateError(`${etiqueta}: no existe ${ruta}`);
  try {
    return JSON.parse(readFileSync(ruta, 'utf-8'));
  } catch (e) {
    throw new CandidateError(`${etiqueta}: JSON ilegible (${e.message})`);
  }
}

/** JSON canónico: claves en orden binario y sin espacios, para que reinstalar dé los MISMOS bytes. */
function canonical(valor) {
  if (Array.isArray(valor)) return `[${valor.map(canonical).join(',')}]`;
  if (valor && typeof valor === 'object') {
    return `{${Object.keys(valor)
      .sort(porBytes)
      .map((k) => `${JSON.stringify(k)}:${canonical(valor[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(valor);
}

function exigeFormaCerrada(objeto, claves, etiqueta) {
  const vistas = Object.keys(objeto).sort(porBytes);
  const sobran = vistas.filter((k) => !claves.includes(k));
  const faltan = claves.filter((k) => !vistas.includes(k));
  if (sobran.length || faltan.length) {
    throw new CandidateError(
      `${etiqueta}: forma inesperada` +
        (faltan.length ? ` · faltan ${JSON.stringify(faltan)}` : '') +
        (sobran.length ? ` · sobran ${JSON.stringify(sobran)}` : ''),
    );
  }
}

/**
 * Bytes de los archivos del shard, VERIFICADOS contra el inventario que el propio shard sella.
 *
 * Copiar primero y confiar después es el orden equivocado: un `series.csv` alterado se instala igual
 * de bien, y el manifiesto de instalación sella después el digest de lo alterado, con lo que la
 * verificación posterior lo da por bueno (R96-P0-4).
 */
function leerSellados(shardRoot, manifest, plan) {
  const files = manifest.files;
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    throw new CandidateError('shard_manifest.json: no trae el inventario `files`');
  }
  const datos = {};
  for (const { desde } of plan) {
    const declarado = files[desde];
    if (typeof declarado !== 'string' || !declarado) {
      throw new CandidateError(`shard_manifest.json: no declara ${desde}`);
    }
    const origen = join(shardRoot, desde);
    if (!existsSync(origen)) throw new CandidateError(`el shard no trae ${desde}`);
    const bytes = readFileSync(origen);
    const visto = sha256(bytes);
    if (visto !== declarado) {
      throw new CandidateError(
        `${desde}: digest ${visto} no coincide con ${declarado} declarado por el shard`,
      );
    }
    datos[desde] = bytes;
  }
  return datos;
}

/**
 * Instala un archivo en el destino vivo. El release es INMUTABLE.
 * @returns {boolean} si hubo escritura (false = ya estaba con los mismos bytes)
 */
function instalarArchivo(ops, root, relativa, datos, token) {
  const destino = join(root, relativa);
  if (existsSync(destino)) {
    if (sha256(readFileSync(destino)) === sha256(datos)) return false;   // idempotente
    throw new CandidateError(
      `${relativa}: ya existe con bytes distintos; un release instalado es inmutable`,
    );
  }
  ops.mkdir(dirname(destino));
  const temporal = `${destino}.installing-${token}`;
  try {
    ops.write(temporal, datos);
    ops.rename(temporal, destino);
  } catch (e) {
    try {
      ops.remove(temporal);
    } catch {
      /* el temporal huérfano no lo referencia el catálogo: no invalida la instalación previa */
    }
    throw e;
  }
  return true;
}

/**
 * Catálogo de releases instalados. Es lo que una vista consulta para saber qué hay y en qué estado;
 * un candidate figura con `visible: false` y ninguna vista pública debe listarlo.
 */
function catalogoConEntrada(root, entrada) {
  const previo = readCatalog(root);
  const otros = previo.releases.filter((r) => claveRelease(r) !== claveRelease(entrada));
  // Upsert por (disease_id, release_id): ni concatenar —duplicaría— ni sobrescribir el catálogo
  // entero —borraría los releases de otros padecimientos—.
  const releases = [...otros, entrada].sort((a, b) => porBytes(claveRelease(a), claveRelease(b)));
  return { schema: INSTALL_SCHEMA, releases };
}

/**
 * Instala un shard bajo `targetRoot`.
 *
 * @param {string} shardRoot  raíz del shard compilado (`<staging>/<disease>/<release>`)
 * @param {string} targetRoot raíz de instalación; en candidate DEBE ser un temporal externo
 * @param {{mode?:string, pointerReleaseId?:string|null, ops?:object}} opciones
 */
export function installShard(
  shardRoot,
  targetRoot,
  { mode = MODE_CANDIDATE, pointerReleaseId = null, ops = FS_OPS } = {},
) {
  if (![MODE_CANDIDATE, MODE_PUBLIC].includes(mode)) {
    throw new CandidateError(`modo de instalación desconocido: ${JSON.stringify(mode)}`);
  }
  const shard = loadCandidateShard(shardRoot);
  const { manifest, web, status } = shard;
  const publicado = manifest.lifecycle === LIFECYCLE_PUBLISHED;

  // ── 1. verificar el origen ANTES de preparar nada ──
  const plan = planDeArchivos(manifest.disease_id, manifest.release_id);
  const bytes = leerSellados(shardRoot, manifest, plan);

  // La galería es metadata del release, no una constante del código: si el shard no la declara, no
  // se adivina (R96-P1-2).
  if (typeof web.gallery_enabled !== 'boolean') {
    throw new CandidateError(
      `web/manifest.json: gallery_enabled ausente o no booleano ` +
        `(${JSON.stringify(web.gallery_enabled)})`,
    );
  }

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

  // ── 2. preparar y validar TODO en memoria ──
  const root = resolve(targetRoot);
  const inputs = {};
  const outputs = {};
  for (const { desde, hacia } of plan) {
    inputs[desde] = sha256(bytes[desde]);
    outputs[hacia] = sha256(bytes[desde]);
  }
  const ordenado = (obj) =>
    Object.fromEntries(Object.keys(obj).sort(porBytes).map((k) => [k, obj[k]]));
  const canales = [...new Set(plan.map((p) => p.canal))].sort(porBytes);

  const manifiesto = {
    schema: INSTALL_SCHEMA,
    shard_schema: manifest.schema,
    mode,
    disease_id: manifest.disease_id,
    release_id: manifest.release_id,
    lifecycle: manifest.lifecycle,
    channels: canales,
    gallery_enabled: web.gallery_enabled,
    publication_label: shard.label,
    publication_status: status,
    inputs: ordenado(inputs),
    outputs: ordenado(outputs),
  };
  exigeFormaCerrada(manifiesto, INSTALL_KEYS, INSTALL_MANIFEST);

  const rutaManifiesto = `publication/${manifest.disease_id}/${manifest.release_id}/${INSTALL_MANIFEST}`;
  const entrada = {
    disease_id: manifest.disease_id,
    release_id: manifest.release_id,
    lifecycle: manifest.lifecycle,
    mode,
    channels: canales,
    gallery_enabled: web.gallery_enabled,
    publication_label: shard.label,
    verdict: status.verdict,
    weeks_available: status.weeks_available,
    weeks_required: status.weeks_required,
    gate_digest: status.gate_digest,
    evaluation_digest: status.evaluation_digest,
    status_digest: status.status_digest,
    // Un candidate NUNCA es visible: la vista pública filtra por esto, no por el nombre.
    visible: mode === MODE_PUBLIC && publicado,
    paths: Object.keys(outputs).sort(porBytes),
  };
  exigeFormaCerrada(entrada, CATALOG_ENTRY_KEYS, `${CATALOG_FILE}: entrada`);
  const catalogo = catalogoConEntrada(root, entrada);

  // ── 3. instalar contenido que todavía NADIE referencia ──
  ops.mkdir(root);
  const token = manifest.release_id;
  for (const { desde, hacia } of plan) instalarArchivo(ops, root, hacia, bytes[desde], token);
  instalarArchivo(ops, root, rutaManifiesto, Buffer.from(canonical(manifiesto), 'utf-8'), token);

  // ── 4. el catálogo es el ÚNICO commit visible, y va al final ──
  const rutaCatalogo = join(root, CATALOG_FILE);
  ops.mkdir(dirname(rutaCatalogo));
  const temporal = `${rutaCatalogo}.installing-${token}`;
  try {
    ops.write(temporal, Buffer.from(canonical(catalogo), 'utf-8'));
    ops.rename(temporal, rutaCatalogo);           // atómico dentro del mismo directorio
  } catch (e) {
    try {
      ops.remove(temporal);
    } catch {
      /* el catálogo anterior sigue en su sitio, byte-idéntico */
    }
    throw e;
  }

  return { root, manifest: manifiesto, catalog: catalogo, files: Object.keys(outputs).sort(porBytes) };
}

/** Lee el catálogo instalado. Sin catálogo no hay releases: no se adivina por directorio. */
export function readCatalog(targetRoot) {
  const ruta = join(resolve(targetRoot), CATALOG_FILE);
  if (!existsSync(ruta)) return { schema: INSTALL_SCHEMA, releases: [] };
  const datos = leerJSON(ruta, CATALOG_FILE);
  if (datos.schema !== INSTALL_SCHEMA) {
    throw new CandidateError(`${CATALOG_FILE}: schema ${JSON.stringify(datos.schema)} no soportado`);
  }
  if (!Array.isArray(datos.releases)) {
    throw new CandidateError(`${CATALOG_FILE}: releases no es una lista`);
  }
  for (const entrada of datos.releases) {
    exigeFormaCerrada(entrada, CATALOG_ENTRY_KEYS, `${CATALOG_FILE}: entrada`);
  }
  return datos;
}

/**
 * Lee un release INSTALADO y lo verifica entero: forma cerrada del manifiesto, identidad, estado y
 * el digest de **todos** sus outputs.
 *
 * Un consumidor que sólo abre el archivo que le interesa da por bueno un árbol con otro alterado
 * (R96-P0-4). Aquí un archivo ausente o alterado FALLA; nunca se omite en silencio.
 */
export function readInstalledRelease(targetRoot, { diseaseId, releaseId }) {
  const root = resolve(targetRoot);
  const base = join(root, 'publication', diseaseId, releaseId);
  const manifiesto = leerJSON(join(base, INSTALL_MANIFEST), INSTALL_MANIFEST);

  if (manifiesto.schema !== INSTALL_SCHEMA) {
    throw new CandidateError(
      `${INSTALL_MANIFEST}: schema ${JSON.stringify(manifiesto.schema)} no soportado`,
    );
  }
  exigeFormaCerrada(manifiesto, INSTALL_KEYS, INSTALL_MANIFEST);
  for (const [clave, esperado] of [
    ['disease_id', diseaseId],
    ['release_id', releaseId],
  ]) {
    if (manifiesto[clave] !== esperado) {
      throw new CandidateError(
        `${INSTALL_MANIFEST}: ${clave}=${JSON.stringify(manifiesto[clave])} describe otro release`,
      );
    }
  }
  if (typeof manifiesto.gallery_enabled !== 'boolean') {
    throw new CandidateError(`${INSTALL_MANIFEST}: gallery_enabled no es booleano`);
  }

  for (const relativa of Object.keys(manifiesto.outputs).sort(porBytes)) {
    const ruta = join(root, relativa);
    if (!existsSync(ruta)) {
      throw new CandidateError(`${relativa}: declarado por ${INSTALL_MANIFEST} y ausente del destino`);
    }
    const visto = sha256(readFileSync(ruta));
    if (visto !== manifiesto.outputs[relativa]) {
      throw new CandidateError(
        `${relativa}: digest ${visto} no coincide con ${manifiesto.outputs[relativa]} instalado`,
      );
    }
  }

  // El estado se revalida aquí: el manifiesto es un transporte, no una autoridad.
  const status = checkPublicationStatus(manifiesto.publication_status, INSTALL_MANIFEST);
  if (status.label !== manifiesto.publication_label) {
    throw new CandidateError(`${INSTALL_MANIFEST}: la etiqueta no coincide con el estado`);
  }
  return { root, base, manifest: manifiesto, status };
}

/** Inventario de rutas instaladas bajo la raíz, para comparar dos instalaciones. */
export function inventory(targetRoot) {
  const root = resolve(targetRoot);
  const salida = {};
  const caminar = (dir) => {
    for (const nombre of readdirSync(dir).sort(porBytes)) {
      const p = join(dir, nombre);
      if (statSync(p).isDirectory()) caminar(p);
      else salida[relative(root, p)] = sha256(readFileSync(p));
    }
  };
  if (existsSync(root)) caminar(root);
  return salida;
}
