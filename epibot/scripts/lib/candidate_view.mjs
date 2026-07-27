/**
 * candidate_view.mjs — C7.6-STATUS-B: view-model PURO de un shard candidate en staging.
 *
 * Junta, en un solo objeto, las tres cosas que nunca deben separarse al mostrar un pronóstico
 * candidate: la condición bajo la que se autorizó publicarlo, la advertencia de que no tiene
 * intervalos, y el hecho de que todavía NO es público. Separarlas es como se producen las capturas
 * de pantalla en las que la cifra viaja sin su advertencia.
 *
 * No recalcula nada: el backend evaluó el gate y `candidate.mjs` validó el contrato transportado.
 * Aquí no se reconstruye el texto en español ni se reimplementa el evaluador (C7.6-STATUS-B).
 */

import { LIFECYCLE_PUBLISHED } from './candidate.mjs';
import { INTERVAL_NONE, UNCERTAINTY_LABEL, toChartSeries } from '../../js/point_only.js';

export { UNCERTAINTY_LABEL };

/**
 * View-model de un shard ya cargado y validado por `loadCandidateShard`.
 *
 * @param {{manifest:object, rows:object[], status:object, label:string}} shard
 * @returns {{
 *   diseaseId:string, releaseId:string, lifecycle:string,
 *   validationLabel:string, uncertaintyLabel:string, band:null,
 *   isPubliclyVisible:boolean, verdict:string, weeksAvailable:number, weeksRequired:number,
 *   gateDigest:string, evaluationDigest:string, observationDatasetId:string, series:object
 * }}
 */
export function buildCandidateView(shard) {
  if (!shard || !shard.manifest || !shard.status) {
    throw new TypeError('buildCandidateView exige un shard cargado con loadCandidateShard()');
  }
  const { manifest, status } = shard;
  const series = toChartSeries(shard.rows, { intervalMethod: manifest.interval_method });

  return {
    diseaseId: manifest.disease_id,
    releaseId: manifest.release_id,
    lifecycle: manifest.lifecycle,

    // La etiqueta viene del backend, verbatim. El dashboard no la reescribe ni la traduce.
    validationLabel: status.label,
    uncertaintyLabel: UNCERTAINTY_LABEL,
    // Point-only: la banda es ausencia, no un arreglo de ceros.
    band: series.band,
    intervalMethod: manifest.interval_method ?? INTERVAL_NONE,

    // Mientras el lifecycle no sea `published`, esto no sale del staging.
    isPubliclyVisible: manifest.lifecycle === LIFECYCLE_PUBLISHED,

    verdict: status.verdict,
    weeksAvailable: status.weeks_available,
    weeksRequired: status.weeks_required,
    completedWeeks: status.completed_weeks,
    targetWeeks: status.target_weeks,
    gateDigest: status.gate_digest,
    evaluationDigest: status.evaluation_digest,
    observationDatasetId: status.observation_dataset_id,

    series,
  };
}
