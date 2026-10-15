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
