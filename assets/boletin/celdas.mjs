// Celdas del boletín en el navegador: cifra impresa o marcador, sin convertir uno en otro.
// Misma regla que scripts/boletin_celdas.py. Un guion («-») sólo vale 0 para calcular cuando la
// categoría sigue la simbología del boletín («no se presentaron casos»); con
// guion.semantica === 'no_publicado' (desde el año guion.desde) no tiene valor. n.d., n.a. y s.n.
// nunca tienen valor. Ninguna función rellena ni devuelve NaN.

export const GUION = '-';
const SIGNIFICADO_POR_OMISION = {
  '-': 'no se presentaron casos',
  'n.d.': 'información no disponible',
  'n.a.': 'no aplica',
  's.n.': 'sin notificación por la entidad federativa'
};

export const esMarcador = v => typeof v === 'string';

/** ¿El guion de esta categoría es una cifra no publicada en ese año? */
export function guionNoPublicado(guion, anio = null) {
  if (!guion || guion.semantica !== 'no_publicado') return false;
  return anio == null || guion.desde == null || anio >= guion.desde;
}

/** Valor para calcular, o null si la celda no tiene valor numérico comparable. */
export function numero(v, guion = null, anio = null) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (v === GUION) return guionNoPublicado(guion, anio) ? null : 0;
  return null;
}

/** Suma de celdas de una fila: marcador común si todas lo son; null si algo no es comparable. */
export function suma(valores, guion = null, anio = null) {
  if (!valores.length) return null;
  if (valores.every(esMarcador) && new Set(valores).size === 1) return valores[0];
  const ns = valores.map(v => numero(v, guion, anio));
  return ns.some(n => n === null) ? null : ns.reduce((a, b) => a + b, 0);
}

/** Orden descendente por valor numérico; lo que no tiene valor va al final, nunca como 0. */
export function compararDesc(a, b) {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

/** Texto que explica una celda no numérica. */
export function significado(v, { guion = null, simbolos = null, anio = null } = {}) {
  if (v == null) return 'Celda en blanco en la fuente: sin dato.';
  if (!esMarcador(v)) return '';
  if (v === GUION && guionNoPublicado(guion, anio)) {
    return 'El cuadro imprime un guion, pero la propia fuente registra casos de esta categoría: cifra no publicada en este cuadro, no cero.';
  }
  const texto = simbolos?.simbolos?.[v] ?? SIGNIFICADO_POR_OMISION[v];
  const fuente = simbolos?.paginas?.length ? `simbología del boletín, p. ${simbolos.paginas.join(' y ')}` : 'simbología del boletín';
  return texto ? `«${v}» impreso: ${texto} (${fuente}).` : `Símbolo impreso «${v}».`;
}

/** Texto visible de una celda: la cifra o el símbolo impreso (el guion como «–»). */
export function muestra(v, formato = n => Number(n).toLocaleString('es-MX')) {
  if (v == null) return 'Sin dato';
  if (v === GUION) return '–';
  if (esMarcador(v)) return v;
  return formato(v);
}

/** Clave de clase CSS para distinguir a la vista cero, guion y cifra no publicada. */
export function clase(v, guion = null, anio = null) {
  if (v === GUION) return guionNoPublicado(guion, anio) ? 'marcador no-publicado' : 'marcador';
  if (esMarcador(v) || v == null) return 'marcador sin-dato';
  return '';
}
