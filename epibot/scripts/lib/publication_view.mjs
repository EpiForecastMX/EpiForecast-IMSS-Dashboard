/**
 * publication_view.mjs — C7.6-ADAPTERS-A: vista GENÉRICA de un release instalado.
 *
 * Resuelve por catálogo y manifiesto, nunca por el nombre del padecimiento: si mañana entra otro
 * release, esta vista lo muestra sin tocar una línea. Y muestra la etiqueta de validación junto a
 * cualquier cifra, porque separarlas es como se producen las capturas en las que el número viaja
 * sin su condición.
 *
 * Antes de leer nada, verifica el release completo —forma cerrada del manifiesto y digest de TODOS
 * sus outputs—: abrir sólo el archivo que interesa daba por bueno un árbol con otro alterado
 * (R96-P0-4).
 *
 * Sin DOM y sin efectos: es un modelo, no una plantilla.
 */

import { readFileSync } from 'fs';
import { join, resolve } from 'path';

import { CandidateError } from './candidate.mjs';
import {
  LIFECYCLE_PUBLISHED,
  MODE_PUBLIC,
  porBytes,
  readCatalog,
  readInstalledRelease,
} from './installer.mjs';
import { UNCERTAINTY_LABEL } from '../../js/point_only.js';
import { toChartSeries } from '../../js/point_only.js';
import { parseCSV } from './candidate.mjs';

export { UNCERTAINTY_LABEL };

const porClave = (a, b) =>
  porBytes(`${a.disease_id}/${a.release_id}`, `${b.disease_id}/${b.release_id}`);

/** Releases que una superficie PÚBLICA puede listar. Un candidate nunca aparece aquí. */
export function publicReleases(targetRoot) {
  return readCatalog(targetRoot)
    .releases.filter((r) => r.visible === true)
    .sort(porClave);
}

/** Todos los releases instalados, con su visibilidad declarada. Para inspección de staging. */
export function installedReleases(targetRoot) {
  return readCatalog(targetRoot).releases.slice().sort(porClave);
}

/**
 * Modelo de vista de un release instalado, resuelto por identidad.
 *
 * @param {string} targetRoot raíz de instalación
 * @param {{diseaseId:string, releaseId:string}} identidad
 */
export function buildReleaseView(targetRoot, { diseaseId, releaseId }) {
  const root = resolve(targetRoot);
  const entrada = readCatalog(root).releases.find(
    (r) => r.disease_id === diseaseId && r.release_id === releaseId,
  );
  if (!entrada) {
    throw new CandidateError(`el catálogo no declara ${diseaseId}/${releaseId}`);
  }

  // Verifica forma cerrada, identidad, estado y el digest de todos los outputs.
  const { base, manifest: instalado, status } = readInstalledRelease(root, { diseaseId, releaseId });

  for (const [clave, esperado] of [
    ['lifecycle', entrada.lifecycle],
    ['mode', entrada.mode],
    ['publication_label', entrada.publication_label],
    ['gallery_enabled', entrada.gallery_enabled],
  ]) {
    if (instalado[clave] !== esperado) {
      throw new CandidateError(
        `publication_install.json: ${clave}=${JSON.stringify(instalado[clave])} contradice el catálogo`,
      );
    }
  }
  for (const [clave, esperado] of [
    ['verdict', status.verdict],
    ['weeks_available', status.weeks_available],
    ['weeks_required', status.weeks_required],
    ['gate_digest', status.gate_digest],
    ['evaluation_digest', status.evaluation_digest],
    ['status_digest', status.status_digest],
  ]) {
    if (entrada[clave] !== esperado) {
      throw new CandidateError(
        `${JSON.stringify(clave)} del catálogo no coincide con el estado instalado`,
      );
    }
  }

  const web = JSON.parse(readFileSync(join(base, 'manifest.json'), 'utf-8'));
  if (web.release_id !== releaseId || web.disease_id !== diseaseId) {
    throw new CandidateError(`manifest.json instalado describe otro release`);
  }
  const rows = parseCSV(readFileSync(join(base, 'series.csv'), 'utf-8'), 'series.csv');
  const series = toChartSeries(rows, { intervalMethod: web.interval_method });

  // Sólo un release publicado, en modo público y con puntero es visible; un candidate se inspecciona.
  const isPubliclyVisible =
    entrada.visible === true &&
    entrada.mode === MODE_PUBLIC &&
    instalado.lifecycle === LIFECYCLE_PUBLISHED;

  return {
    diseaseId,
    releaseId,
    displayName: web.display_name ?? diseaseId,
    lifecycle: instalado.lifecycle,
    mode: instalado.mode,

    // Las dos advertencias viajan juntas y con cualquier cifra.
    validationLabel: status.label,
    uncertaintyLabel: UNCERTAINTY_LABEL,
    band: series.band,

    isPubliclyVisible,
    // Metadata del release × visibilidad. Nunca una constante: un release que sí va a la galería
    // tiene que poder entrar sin editar esta línea (R96-P1-2).
    galleryEnabled: instalado.gallery_enabled,
    inGallery: instalado.gallery_enabled === true && isPubliclyVisible,

    verdict: status.verdict,
    weeksAvailable: status.weeks_available,
    weeksRequired: status.weeks_required,
    gateDigest: status.gate_digest,
    evaluationDigest: status.evaluation_digest,

    rows: rows.length,
    series,
    reports: {
      report: join(root, 'Reports', 'publication', diseaseId, releaseId, 'report.md'),
      products: join(root, 'Reports', 'publication', diseaseId, releaseId, 'forecast_products.csv'),
    },
  };
}
