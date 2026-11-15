// Mismo calendario domingo–sábado de epiforecast/data/epi_calendar.py.
const DIA = 86400000;
function fechaUTC(fecha) {
  if (typeof fecha === 'string') {
    const [y,m,d] = fecha.split('-').map(Number);
    return new Date(Date.UTC(y,m-1,d));
  }
  return new Date(Date.UTC(fecha.getFullYear(),fecha.getMonth(),fecha.getDate()));
}
function inicioAnio(y) {
  const jan4 = new Date(Date.UTC(y,0,4));
  return new Date(jan4.getTime()-jan4.getUTCDay()*DIA);
}
export function semanaBoletin(fecha = new Date()) {
  const dt = fechaUTC(fecha);
  if (!Number.isFinite(dt.getTime())) throw new TypeError('Fecha no válida');
  const domingo = new Date(dt.getTime()-dt.getUTCDay()*DIA);
  let year = domingo.getUTCFullYear()+1;
  while (inicioAnio(year)>domingo) year--;
  return {year,week:Math.floor((domingo-inicioAnio(year))/(7*DIA))+1};
}

/** Semanas (52 o 53) del año epidemiológico `y`, con la regla del 4 de enero. */
export function semanasDelAnio(y) {
  return Math.round((inicioAnio(Number(y) + 1) - inicioAnio(Number(y))) / (7 * DIA));
}

/**
 * `[año, semana]` MMWR desplazada `k` semanas (k entero, puede ser negativo). Cruza 52/53 → 1 con el
 * calendario, nunca con aritmética de la semana: tras 2025-W53 viene 2026-W01 y tras 2026-W52,
 * 2027-W01. Una semana fuera de 1..semanasDelAnio(año) es un error, no se corrige en silencio.
 */
export function semanaSiguiente(year, week, k = 1) {
  const y = Number(year);
  const w = Number(week);
  if (!Number.isInteger(y) || !Number.isInteger(w) || !Number.isInteger(k) || w < 1 || w > semanasDelAnio(y)) {
    throw new RangeError(`Semana epidemiológica no válida: ${year}-W${week} (+${k})`);
  }
  const inicio = new Date(inicioAnio(y).getTime() + (w - 1 + k) * 7 * DIA);
  const { year: a, week: s } = semanaBoletin(inicio.toISOString().slice(0, 10));
  return [a, s];
}

export function rezagoBoletin(fecha, year, week) {
  const actual=semanaBoletin(fecha);
  const inicioActual=inicioAnio(actual.year).getTime()+(actual.week-1)*7*DIA;
  const inicioDato=inicioAnio(Number(year)).getTime()+(Number(week)-1)*7*DIA;
  return Math.round((inicioActual-inicioDato)/(7*DIA));
}

export function estadoHorizonte(data, fecha = new Date(), pad) {
  const h = data.comparacion_rondas?.horizonte_actual;
  const wc = data.weekly_comparison || {};
  const info = wc[pad] || Object.values(wc)[0];
  const rows = info?.version === 2 ? info.semanas || [] : [];
  const observadas = rows.filter(w=>w.fase==='seguimiento' && Number.isFinite(w.real));
  const inicio = h?.inicio || rows.find(w=>w.horizonte===1)?.periodo_inicio;
  const now = fechaUTC(fecha);
  return {
    corte: h?.corte || info?.corte || 'no documentado',
    pasos: h?.pasos || data.training_config?.horizonte || 52,
    semanasObservadas: observadas.length,
    // Periodos del boletín, no pasos internos del modelo (hay un paso sin semana).
    periodoActual: inicio ? Math.max(0,Math.floor((now-fechaUTC(inicio))/(7*DIA))+1) : null,
    sinSemana: h?.pasos_sin_semana?.length || 0,
  };
}
