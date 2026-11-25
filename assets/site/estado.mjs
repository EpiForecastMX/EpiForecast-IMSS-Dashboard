/**
 * estado.mjs — icono de cada estado de publicación, una sola fuente para la Galería y el Dashboard (24-nov-2026, mesa
 * de expertos). assets/site/estado-ficha.js (script clásico de las fichas) lleva la misma tabla; tests/areas.test.mjs
 * exige que coincidan. El control estacional nunca usa el icono de validado ni el de validación en curso.
 */
export const ICONO_ESTADO = Object.freeze({
  pass: 'i-estado-validado',
  pending: 'i-estado-en-validacion',
  control: 'i-estado-control',
  legacy: 'i-estado-previo',
});

/** <svg><use href="…icons.svg#…"></svg> decorativo; `sprite` es la ruta al sprite desde la página. */
export function iconoSvg(doc, sprite, nombre, clase = 'ico') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(ns, 'svg');
  svg.setAttribute('class', clase);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = doc.createElementNS(ns, 'use');
  use.setAttribute('href', `${sprite}#${nombre}`);
  svg.append(use);
  return svg;
}
