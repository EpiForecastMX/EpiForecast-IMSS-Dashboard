/**
 * point_only.js — C7.3b: cómo se dibuja un pronóstico SIN intervalo de incertidumbre.
 *
 * El release del runner es point-only: `yhat_lower`/`yhat_upper` viajan vacíos a propósito. El error
 * que hay que evitar no es un crash, es un gráfico creíble y falso: convertir el vacío en 0 dibuja
 * una banda que llega hasta el eje y sugiere una certeza que nadie calculó.
 *
 * Estas funciones son puras y sin DOM, para poder probarlas.
 */

export const UNCERTAINTY_LABEL = 'Pronóstico puntual; sin intervalo de incertidumbre';
export const INTERVAL_NONE = 'none';

/** `''`, `null`, `undefined` y `NaN` son AUSENCIA. Nunca 0. */
export function toValue(raw) {
  if (raw === null || raw === undefined) return null;
  const texto = String(raw).trim();
  if (texto === '' || texto.toLowerCase() === 'nan' || texto.toLowerCase() === 'none') return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : null;
}

/** ¿Este conjunto de filas tiene banda dibujable? Sólo si TODAS traen ambos límites. */
export function hasInterval(rows) {
  if (!rows || !rows.length) return false;
  return rows.every((f) => toValue(f.yhat_lower) !== null && toValue(f.yhat_upper) !== null);
}

/**
 * Serie lista para graficar. Con `interval_method='none'` la banda NO existe: `band` es null, no
 * un arreglo de ceros ni un arreglo de la propia línea.
 */
export function toChartSeries(rows, { intervalMethod = INTERVAL_NONE } = {}) {
  const puntos = (rows || []).map((f) => ({
    ds: f.ds,
    epiYear: Number(f.epi_year),
    epiWeek: Number(f.epi_week),
    yhat: toValue(f.yhat_cases),
  }));
  const conBanda = intervalMethod !== INTERVAL_NONE && hasInterval(rows);
  return {
    points: puntos,
    band: conBanda
      ? (rows || []).map((f) => [toValue(f.yhat_lower), toValue(f.yhat_upper)])
      : null,
    intervalMethod,
    // La etiqueta viaja con la serie: si el gráfico se muestra, el aviso se muestra con él.
    uncertaintyLabel: conBanda ? null : UNCERTAINTY_LABEL,
  };
}

/**
 * ¿Este shard puede salir a la superficie pública? Sólo si su lifecycle es `published`.
 * Un candidate se puede inspeccionar en staging, nunca publicar.
 */
export function isPubliclyVisible(manifest) {
  return Boolean(manifest) && manifest.lifecycle === 'published';
}
