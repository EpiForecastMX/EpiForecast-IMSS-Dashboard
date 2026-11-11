#!/usr/bin/env node
// Construye assets/dashboard/catalog.json (epidashboard.catalog.v2) a partir de:
//   publication/catalog.json, Reports/zoom_data_neuro.json, Reports/zoom_data_dengue.json
//   y publication/<disease_id>/vista.json de cada miembro publicado.
// Determinista: sin reloj, sin entorno, sin red. Sólo lee las fuentes; escribe un único archivo.
//
// Uso:
//   node scripts/build_dashboard_catalog.mjs [--root DIR] [--out RUTA] [--check]
//   --root  raíz del sitio (por defecto el directorio actual)
//   --out   salida relativa a la raíz (por defecto assets/dashboard/catalog.json)
//   --check no escribe; rc=1 si la salida falta o difiere byte a byte de la esperada.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { COHORTS } from '../assets/dashboard/data.mjs';
import { makeCatalog, selectPublishedMembers, validateCatalog } from '../assets/dashboard/unified.mjs';

export const DEFAULT_OUT = 'assets/dashboard/catalog.json';
export const PUBLICATION_CATALOG = 'publication/catalog.json';

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function readJson(root, rel) {
  const file = path.join(root, rel);
  let buf;
  try {
    buf = fs.readFileSync(file);
  } catch (err) {
    throw new Error(`[builder] no se pudo leer ${rel}: ${err.code ?? err.message}`);
  }
  return { json: JSON.parse(buf.toString('utf8')), sha: sha256(buf) };
}

/** Devuelve {catalog, text}. No escribe nada. */
export function buildCatalog(root = process.cwd()) {
  const pub = readJson(root, PUBLICATION_CATALOG);
  const neuro = readJson(root, COHORTS.neuro);
  const dengue = readJson(root, COHORTS.dengue);
  const views = {};
  const viewSha = {};
  for (const m of selectPublishedMembers(pub.json)) {
    const rel = `publication/${m.disease_id}/vista.json`;
    const v = readJson(root, rel); // ausente => lanza: fallo cerrado
    views[m.disease_id] = v.json;
    viewSha[m.disease_id] = v.sha;
  }
  const base = makeCatalog({ legacy: { neuro: neuro.json, dengue: dengue.json }, publication: pub.json, views });
  const cohortSha = { neuro: neuro.sha, dengue: dengue.sha };
  const diseases = base.diseases.map((d) => ({
    ...d,
    sourceSha256: d.kind === 'legacy' ? cohortSha[d.cohort] : viewSha[d.id],
  }));
  const catalog = validateCatalog({
    schema: base.schema,
    diseases,
    summary: base.summary,
    sources: {
      publicationCatalog: { path: PUBLICATION_CATALOG, sha256: pub.sha },
      zoom: {
        neuro: { path: COHORTS.neuro, sha256: neuro.sha },
        dengue: { path: COHORTS.dengue, sha256: dengue.sha },
      },
    },
  });
  return { catalog, text: `${JSON.stringify(catalog)}\n` };
}

/** Compara la salida instalada con la esperada. {ok, reason}. */
export function checkCatalog(root = process.cwd(), out = DEFAULT_OUT) {
  const { text } = buildCatalog(root);
  const file = path.join(root, out);
  let current;
  try {
    current = fs.readFileSync(file);
  } catch {
    return { ok: false, reason: `falta ${out}` };
  }
  if (!current.equals(Buffer.from(text, 'utf8'))) return { ok: false, reason: `${out} desactualizado` };
  return { ok: true, reason: null };
}

function parseArgs(argv) {
  const args = { root: process.cwd(), out: DEFAULT_OUT, check: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--check') args.check = true;
    else if (a === '--root') args.root = path.resolve(argv[++i] ?? '');
    else if (a === '--out') args.out = argv[++i] ?? DEFAULT_OUT;
    else throw new Error(`[builder] argumento desconocido: ${a}`);
  }
  if (path.isAbsolute(args.out) || args.out.split(/[\\/]/).includes('..')) {
    throw new Error('[builder] --out debe ser relativa a la raíz y sin ".."');
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.check) {
    const res = checkCatalog(args.root, args.out);
    if (!res.ok) {
      process.stderr.write(`[builder] --check: ${res.reason}. Ejecute node scripts/build_dashboard_catalog.mjs\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(`[builder] ${args.out} al día\n`);
    return;
  }
  const { catalog, text } = buildCatalog(args.root);
  const file = path.join(args.root, args.out);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  const s = catalog.summary;
  process.stdout.write(`[builder] ${args.out}: ${s.diseases} padecimientos (${s.legacy} legacy, ${s.release} release), ${s.series} series\n`);
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invoked) {
  try {
    main();
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exitCode = 1;
  }
}
