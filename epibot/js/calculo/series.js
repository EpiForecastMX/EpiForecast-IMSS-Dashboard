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
    observado: zz.d.map((ds, i) => [ds, zz.r[i]]).filter(([ds, r]) => r != null && ds <= zz.last_real),
    pronostico: zz.d.map((ds, i) => [ds, zz.y[i]]).filter(([, y]) => y != null),
    tipo: 'original', lugar: estado ? nombreEstado(estado) : 'el país', sexo,
    corte: zz.last_real || null, sinIntervalo: !zz.intervalo_disponible,
  };
}
