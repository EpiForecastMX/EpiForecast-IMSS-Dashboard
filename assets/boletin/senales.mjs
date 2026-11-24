// «Lo que cambia frente al mismo periodo del año anterior»: lógica pura, sin DOM. No calcula cifras nuevas:
// ordena el mismo cambio porcentual que la columna «Vs. año anterior» del catálogo (acumulado del año frente al
// acumulado del mismo periodo del año anterior que imprime el boletín).

/** Cambio porcentual del acumulado; null si alguna cifra no es comparable o la base es 0. */
export function cambio(d, num) {
  const a = num(d.cumulative, d), b = num(d.previous, d);
  if (a === null || b === null || !b) return null;
  return (a / b - 1) * 100;
}

/**
 * Las n categorías que más aumentan y las n que más disminuyen, sin agregados y con al menos `minPrevio`
 * notificaciones el año anterior (para no destacar cambios grandes sobre bases pequeñas).
 */
export function senales(diseases, num, { minPrevio = 1000, n = 5 } = {}) {
  const filas = diseases.filter((d) => !d.aggregate)
    .map((d) => ({ d, a: num(d.cumulative, d), b: num(d.previous, d), pct: cambio(d, num) }))
    .filter((x) => x.pct !== null && x.b >= minPrevio);
  const orden = (s) => (x, y) => s * (y.pct - x.pct) || x.d.name.localeCompare(y.d.name, 'es');
  return {
    suben: filas.filter((x) => x.pct > 0).sort(orden(1)).slice(0, n),
    bajan: filas.filter((x) => x.pct < 0).sort(orden(-1)).slice(0, n),
    total: filas.length,
  };
}

/** Porcentaje legible con un decimal y signo; «Sin cambio» si redondea a 0. */
export function textoCambio(pct) {
  if (pct === null || pct === undefined) return 'Sin cifra comparable';
  const r = Math.round(pct * 10) / 10;
  if (r === 0) return 'Sin cambio';
  return `${r > 0 ? '+' : '−'}${Math.abs(r).toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}
