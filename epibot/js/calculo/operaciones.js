/**
 * calculo/operaciones.js — calculadora determinista del EpiBot (mesa agéntica, fase 1, 25-nov-2026).
 *
 * Funciones puras sobre una serie normalizada `{ observado: [[ds, y]…], pronostico: [[ds, y]…], tipo, lugar, … }` (ver
 * `series.js`). Ninguna inventa datos: si la operación no procede con estos números devuelve `null` o un objeto con el motivo.
 * Sirven igual en el navegador y en una función de Netlify (sin DOM ni red).
 *
 * Reglas de legitimidad (dictamen de epidemiología de la mesa):
 * - Un cambio porcentual sólo se afirma con base suficiente (al menos 10 casos de base y 20 en alguna de las dos ventanas)
 *   y si supera el ruido de conteo (|F4 − O4| ≥ 2·√O4).
 * - La estacionalidad usa sólo años completos observados (al menos 50 semanas) y dice cuántos son.
 * - Nada de tasas (no hay población en las vistas), intervalos ni significancia.
 */

const suma = (xs) => xs.reduce((a, [, y]) => a + (Number(y) || 0), 0);
export const BASE_MINIMA = 10;
export const VENTANA_MINIMA = 20;

/** O4 (últimas 4 semanas observadas), F4 (4 siguientes pronosticadas) y si el cambio se puede afirmar. */
export function crecimiento(s) {
  const obs = s?.observado || [];
  if (obs.length < 4) return null;
  const ultimo = obs[obs.length - 1][0];
  const O4 = suma(obs.slice(-4));
  const fut = (s.pronostico || []).filter(([ds]) => ds > ultimo).slice(0, 4);
  if (fut.length < 4) return null;
  const F4 = suma(fut);
  const delta = O4 > 0 ? F4 / O4 - 1 : null;
  const basePequena = O4 < BASE_MINIMA || Math.max(O4, F4) < VENTANA_MINIMA;
  const dentroDelRuido = O4 > 0 ? Math.abs(F4 - O4) < 2 * Math.sqrt(O4) : true;
  return { O4, F4, delta, basePequena, dentroDelRuido, afirmable: delta != null && !basePequena && !dentroDelRuido, ultimo };
}

/** Promedio semanal de casos por mes del año, con los años completos observados. */
export function estacionalidad(s) {
  const obs = s?.observado || [];
  const porAnio = new Map();
  for (const [ds] of obs) porAnio.set(ds.slice(0, 4), (porAnio.get(ds.slice(0, 4)) || 0) + 1);
  const anios = [...porAnio].filter(([, n]) => n >= 50).map(([a]) => a).sort();
  if (anios.length < 2) return null;
  const meses = Array.from({ length: 12 }, () => ({ s: 0, n: 0 }));
  for (const [ds, y] of obs) {
    if (!anios.includes(ds.slice(0, 4))) continue;
    const m = Number(ds.slice(5, 7)) - 1;
    meses[m].s += Number(y) || 0;
    meses[m].n += 1;
  }
  const promedio = meses.map((m) => (m.n ? m.s / m.n : 0));
  const media = promedio.reduce((a, b) => a + b, 0) / 12;
  const orden = promedio.map((v, i) => [i, v]).sort((a, b) => b[1] - a[1]);
  return { anios, promedio, media, orden, pocos: media < 5 };
}

/** Rasgos de la gráfica de una serie: tramos, máximos y el corte entre lo observado y lo pronosticado. */
export function rasgosGrafica(s) {
  const obs = s?.observado || [];
  if (!obs.length) return null;
  const ultimo = obs[obs.length - 1][0];
  const fut = (s.pronostico || []).filter(([ds]) => ds > ultimo);
  const max = (xs) => (xs.length ? xs.reduce((a, b) => (Number(b[1]) > Number(a[1]) ? b : a)) : null);
  const recientes = obs.filter(([ds]) => ds >= `${Number(ultimo.slice(0, 4)) - 1}${ultimo.slice(4)}`);
  return {
    primeroObs: obs[0][0], ultimoObs: ultimo, semanasObs: obs.length,
    primeroPron: fut[0]?.[0] || null, ultimoPron: fut.at(-1)?.[0] || null, semanasPron: fut.length,
    maxReciente: max(recientes), picoPron: max(fut),
  };
}

/**
 * Compara el ritmo de cambio de varias series (mismo padecimiento en varios lugares o varios padecimientos en un lugar).
 * Devuelve las filas ordenadas y el veredicto: cuál sube más rápido, o por qué no se puede decir.
 */
export function compararRitmo(filas, direccion = 'sube') {
  const conC = filas.map((f) => ({ ...f, c: crecimiento(f.serie) })).filter((f) => f.c);
  if (conC.length < 2) return { veredicto: 'sin_datos', filas: conC };
  const comparables = conC.filter((f) => !f.c.basePequena && f.c.delta != null);
  if (comparables.length < 2) return { veredicto: 'pocos_casos', filas: conC };
  const orden = [...comparables].sort((a, b) => (direccion === 'baja' ? a.c.delta - b.c.delta : b.c.delta - a.c.delta));
  const tipos = new Set(comparables.map((f) => f.serie.tipo));
  const mezclaControl = tipos.has('control') && tipos.size > 1;
  const todosControl = tipos.size === 1 && tipos.has('control');
  const cortes = new Set(comparables.map((f) => f.serie.corte).filter(Boolean));
  const veredicto = direccion === 'baja'
    ? (orden[0].c.delta >= -0.1 ? 'nadie_baja' : orden[0].c.dentroDelRuido ? 'ruido' : 'baja')
    : (orden[0].c.delta <= 0.1 ? 'nadie_sube' : orden[0].c.dentroDelRuido ? 'ruido' : 'sube');
  return { veredicto, orden, filas: conC, mezclaControl, todosControl, cortesDistintos: cortes.size > 1, excluidas: conC.length - comparables.length };
}
