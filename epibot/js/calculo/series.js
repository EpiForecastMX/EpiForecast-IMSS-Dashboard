/**
 * calculo/series.js — una sola forma de serie para la calculadora (mesa agéntica, fase 1, 25-nov-2026).
 *
 * Los 148 padecimientos del runner vienen de `publication/<id>/vista.json`; los cuatro originales (Dengue, Depresión,
 * Parkinson, Alzheimer) de `zoom_series.json`. Ambos se convierten a
 * `{ observado, pronostico, tipo: 'control'|'modelo'|'original', lugar, sexo, corte, sinIntervalo }`.
 */

const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const nombreEstado = (n) => (n === 'México' ? 'Estado de México' : n);
const mismoEstado = (a, b) => {
  const x = norm(a), y = norm(b);
  return x === y || (x === 'mexico' && y === 'estado de mexico') || (x === 'estado de mexico' && y === 'mexico');
};

export const esControlVista = (v) => !!v?.caida_al_control || v?.portafolio_igual_al_control === true;

/** Serie de una vista del runner para un estado (o nacional) y un sexo; null si no existe. */
export function serieDeVista(v, { estado = null, sexo = 'general' } = {}) {
  const xs = Object.values(v?.series || {});
  const sx = xs.some((s) => s.sexo === sexo) ? sexo : 'general';
  const x = estado
    ? xs.find((s) => s.nivel === 'estado' && s.sexo === sx && mismoEstado(s.nombre, estado))
    : xs.find((s) => s.nivel === 'nacional' && s.sexo === sx);
  if (!x) return null;
  return {
    observado: x.observado || [], pronostico: x.pronostico || [],
    tipo: esControlVista(v) ? 'control' : 'modelo',
    lugar: estado ? nombreEstado(x.nombre) : 'el país', sexo: sx,
    corte: v.observation_cutoff_ds || null,
    sinIntervalo: /sin interval/i.test(v.uncertainty_label || ''),
  };
}

/**
 * Fecha del boletín de un punto de zoom_series.json (cuatro originales). `d` es la fecha interna del motor (un lunes) y el
 * periodo del boletín empieza 13 días después (el domingo de la semana epidemiológica): comprobado en las 3,017 semanas
 * observadas y las 3,024 pronosticadas del seguimiento de todas las series (mesa de gráficas, 25-nov-2026). Antes se
 * mostraba `d` y las gráficas y el texto quedaban unas dos semanas atrás («hasta la del 19 de octubre» por la semana 44).
 */
export const DIAS_A_BOLETIN = 13;
export function fechaBoletinLegacy(d) {
  const t = Date.parse(`${d}T00:00:00Z`);
  return Number.isFinite(t) ? new Date(t + DIAS_A_BOLETIN * 864e5).toISOString().slice(0, 10) : d;
}

/**
 * Rezago impreso de cada original (mesa de la plataforma, 25-nov-2026, Codex Sol): el boletín N trae Dengue «hasta la semana
 * N» (cuadro 7.2) y Depresión, Parkinson y Alzheimer «hasta la semana N−1» (cuadro 17). zoom_series.json rotula cada punto
 * con la semana del boletín; la semana epidemiológica del dato es esa menos el rezago. Lo comprueba tests/test_graficas_mesa.mjs
 * contra el encabezado del cuadro en la foto vigente del radar.
 */
export const REZAGO_LEGACY = { Dengue: 0, Depresion: 1, Parkinson: 1, Alzheimer: 1 };

/** Inicio (domingo) de la semana epidemiológica del dato de un original: semana del boletín menos su rezago. */
export function fechaEpiLegacy(d, pad) {
  const b = fechaBoletinLegacy(d), k = REZAGO_LEGACY[pad] ?? 0;
  if (!k || b === d) return b;
  return new Date(Date.parse(`${b}T00:00:00Z`) - 7 * k * 864e5).toISOString().slice(0, 10);
}

const LEGACY = { Dengue: 'dengue', Depresion: 'depresion', Parkinson: 'parkinson', Alzheimer: 'alzheimer' };
export const esLegacy = (pad) => !!LEGACY[pad];

/** Serie de un padecimiento original desde zoom_series.json. */
export function serieLegacy(zoom, pad, { estado = null, sexo = 'general' } = {}) {
  if (!zoom || !LEGACY[pad]) return null;
  let geo = estado ? norm(estado) : 'nacional';
  if (geo === 'estado de mexico' && !zoom[`${LEGACY[pad]}|estado de mexico|${sexo}`]) geo = 'mexico';
  const zz = zoom[`${LEGACY[pad]}|${geo}|${sexo}`] || zoom[`${LEGACY[pad]}|${geo}|general`];
  if (!zz || !Array.isArray(zz.d)) return null;
  return {
    observado: zz.d.map((ds, i) => [ds, zz.r[i]]).filter(([ds, r]) => r != null && ds <= zz.last_real).map(([ds, r]) => [fechaEpiLegacy(ds, pad), r]),
    pronostico: zz.d.map((ds, i) => [fechaEpiLegacy(ds, pad), zz.y[i]]).filter(([, y]) => y != null),
    tipo: 'original', lugar: estado ? nombreEstado(estado) : 'el país', sexo,
    corte: zz.last_real ? fechaEpiLegacy(zz.last_real, pad) : null, sinIntervalo: !zz.intervalo_disponible,
    // Corte del modelo: antes de él, «pronóstico» es el ajuste histórico; el horizonte publicado empieza después.
    dsCorte: zz.ds_corte ? fechaEpiLegacy(zz.ds_corte, pad) : null,
  };
}
