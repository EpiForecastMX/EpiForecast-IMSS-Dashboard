/**
 * publication_view.mjs — C7.6-ADAPTERS-A: vista GENÉRICA de un release instalado.
 *
 * Resuelve por catálogo y manifiesto, nunca por el nombre del padecimiento: si mañana entra otro
 * release, esta vista lo muestra sin tocar una línea. Y muestra la etiqueta de validación junto a
 * cualquier cifra, porque separarlas es como se producen las capturas en las que el número viaja
 * sin su condición.
 *
 * Sin DOM y sin efectos: es un modelo, no una plantilla.
 */

import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

import { CandidateError, checkPublicationStatus } from './candidate.mjs';
import { INSTALL_MANIFEST, INSTALL_SCHEMA, LIFECYCLE_PUBLISHED, readCatalog } from './installer.mjs';
import { UNCERTAINTY_LABEL } from '../../js/point_only.js';
import { toChartSeries } from '../../js/point_only.js';
import { parseCSV } from './candidate.mjs';

export { UNCERTAINTY_LABEL };

/** Releases que una superficie PÚBLICA puede listar. Un candidate nunca aparece aquí. */
export function publicReleases(targetRoot) {
  return readCatalog(targetRoot).releases.filter((r) => r.visible === true);
}

/** Todos los releases instalados, con su visibilidad declarada. Para inspección de staging. */
export function installedReleases(targetRoot) {
  return readCatalog(targetRoot).releases;
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

  const base = join(root, 'publication', diseaseId, releaseId);
  const rutaManifiesto = join(base, INSTALL_MANIFEST);
  if (!existsSync(rutaManifiesto)) {
    throw new CandidateError(`${diseaseId}/${releaseId}: falta ${INSTALL_MANIFEST}`);
  }
  const instalado = JSON.parse(readFileSync(rutaManifiesto, 'utf-8'));
  if (instalado.schema !== INSTALL_SCHEMA) {
    throw new CandidateError(
      `${INSTALL_MANIFEST}: schema ${JSON.stringify(instalado.schema)} no soportado`,
    );
  }
  for (const [clave, esperado] of [
    ['disease_id', diseaseId],
    ['release_id', releaseId],
    ['lifecycle', entrada.lifecycle],
    ['publication_label', entrada.publication_label],
  ]) {
    if (instalado[clave] !== esperado) {
      throw new CandidateError(
        `${INSTALL_MANIFEST}: ${clave}=${JSON.stringify(instalado[clave])} contradice el catálogo`,
      );
    }
  }
  // El estado se revalida aquí: el catálogo es un índice, no una autoridad.
  const status = checkPublicationStatus(instalado.publication_status, INSTALL_MANIFEST);
  if (status.label !== instalado.publication_label) {
    throw new CandidateError(`${INSTALL_MANIFEST}: la etiqueta no coincide con el estado`);
  }

  const web = JSON.parse(readFileSync(join(base, 'manifest.json'), 'utf-8'));
  if (web.release_id !== releaseId || web.disease_id !== diseaseId) {
    throw new CandidateError(`manifest.json instalado describe otro release`);
  }
  const rows = parseCSV(readFileSync(join(base, 'series.csv'), 'utf-8'), 'series.csv');
  const series = toChartSeries(rows, { intervalMethod: web.interval_method });

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

    // Sólo un release publicado y con puntero es visible; un candidate se inspecciona, no se lista.
    isPubliclyVisible: entrada.visible === true && instalado.lifecycle === LIFECYCLE_PUBLISHED,
    inGallery: false,

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
