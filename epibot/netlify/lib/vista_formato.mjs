/**
 * vista_formato.mjs — Formateo sin valores nulos convertidos en cero, rangos MMWR de semanas OOS
 * y resúmenes metodológicos/veredictos para `vista_grounding.mjs`, sin cifras hardcodeadas.
 */
import { semana, semanaSig } from './vista_turno.mjs';

export const MOTOR_ES = {
  ets_add_damped_log1p: 'ETS amortiguado (log)',
  prophet_count_log1p: 'Prophet en conteos (log)',
  prophet_rate_log1p: 'Prophet en tasa (log)',
  ridge_harmonic_log1p: 'Ridge armónico (log)',
  seasonal_naive_lag52: 'naive estacional (rezago de 52 semanas)',
  seasonal_mean_3y: 'media estacional de 3 años',
  seasonal_median_3y: 'mediana estacional de 3 años',
  seasonal_mean_5y: 'media estacional de 5 años',
  seasonal_median_5y: 'mediana estacional de 5 años',
  seasonal_mean_2y: 'media estacional de 2 años',
  portfolio: 'portafolio derivado por suma de las series base',
};

const AMBITO_CONTROL = {
  smape_bases: (sinSexo) => (sinSexo ? 'las series por estado' : 'las series por estado y sexo'),
  smape_all: () => 'el conjunto de las series publicadas',
  smape_nacional_general: () => 'el total nacional',
};

export const tieneValor = (x) => x !== null && x !== undefined && Number.isFinite(Number(x));
export const ent = (n) => Math.round(Number(n)).toLocaleString('en-US');
export const uno = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const num = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
export const pct = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
export const lista = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}` : xs[0] || '');

export function rangoOos(origin, semanas, sep = ' a ') {
  if (!semanas || semanas <= 0) return null;
  const wIni = semana(semanaSig(origin, 1));
  return semanas === 1 ? wIni : `${wIni}${sep}${semana(semanaSig(origin, semanas))}`;
}

export function metricasDetalladas(oos) {
  const m = [];
  if (tieneValor(oos?.mae)) m.push(`**MAE de ${num(oos.mae)} casos**`);
  if (tieneValor(oos?.smape)) m.push(`**sMAPE de ${pct(oos.smape)} %**`);
  if (tieneValor(oos?.sesgo_pct)) m.push(`**sesgo de ${pct(oos.sesgo_pct)} %**`);
  return m;
}

export function resumenOosCorto(oos, incluirSesgo = true) {
  const partes = [];
  if (tieneValor(oos?.observado_total) && tieneValor(oos?.pronostico_total)) {
    partes.push(`${ent(oos.observado_total)} obs. vs ${ent(oos.pronostico_total)} pron.`);
  }
  if (tieneValor(oos?.mae)) partes.push(`MAE ${num(oos.mae)}`);
  if (tieneValor(oos?.smape)) partes.push(`sMAPE ${pct(oos.smape)} %`);
  if (incluirSesgo && tieneValor(oos?.sesgo_pct)) partes.push(`sesgo ${pct(oos.sesgo_pct)} %`);
  return partes.join(', ');
}

export function geoEtiqueta(s) {
  if (s.nivel === 'nacional') return 'el total nacional (México)';
  return s.nombre === 'México' ? 'Estado de México' : s.nombre;
}

export function hallarSerie(v, geo, sx) {
  if (geo.nivel === 'nacional') return v.series[`nacional|mx|${sx}`] || null;
  return Object.values(v.series).find((s) => s.nivel === geo.nivel && s.nombre === geo.nombre && s.sexo === sx) || null;
}

export function metaVista(r, v, pruebaAnio = null) {
  const wOr = semana(v.origin);
  const wIni = semana(semanaSig(v.origin, 1));
  const wFin = semana(semanaSig(v.origin, v.horizon_weeks));
  const nac = v.series['nacional|mx|general'];
  const wa = v.weeks_available ?? 0;
  const wr = v.weeks_required ?? 4;
  const sinAlt = v.portafolio_igual_al_control === true ? r.pruebaSinAlternativa : null;
  const anio = String(v.caida_al_control?.fold || sinAlt?.fold || '').replace(/^test_/, '') || pruebaAnio || '2025';
  const wOos = rangoOos(v.origin, nac?.oos?.semanas, '–');
  const preEm = Boolean(r.cronologia && /antes de emitir/i.test(r.cronologia));
  const estCorto = v.caida_al_control
    ? `Control estacional no validado (portafolio rechazado en prueba única ${anio}; ${wa}/${wr} contador técnico)`
    : v.portafolio_igual_al_control === true
    ? `Control estacional no validado (sin alternativa con un año de historia; ${wa}/${wr} contador técnico)`
    : (v.verdict === 'FAIL'
      ? `Portafolio aceptado en prueba ${anio}; validación prospectiva ${wa}/${wr} FAIL`
      : `Portafolio aceptado en ${anio} (${wa}/${wr} ${v.verdict})`);
  return { nombre: v.nombre_completo || r.etiqueta, wOr, wIni, wFin, nac, wa, wr, anio, wOos, preEm, estCorto };
}

export function resumenMetodo(r, v, m, prueba, serieRef, sinSexo) {
  const caida = v.caida_al_control;
  if (caida) {
    const comp = Object.fromEntries((caida.comprobaciones || []).map((c) => [c.ambito, c]));
    const fallas = (caida.comprobaciones || []).filter((c) => !c.pasa)
      .map((c) => `${AMBITO_CONTROL[c.ambito](sinSexo)} (sMAPE ${uno(c.portafolio)} frente a ${uno(c.control)} del control)`);
    const errs = ['smape_bases', 'smape_all', 'smape_nacional_general'].filter((a) => comp[a])
      .map((a) => `${uno(comp[a].control)} en ${AMBITO_CONTROL[a](sinSexo)}`);
    const baseMotor = MOTOR_ES[caida.motor] || caida.motor;
    const comoSerie = serieRef?.motor === 'portfolio'
      ? `la serie se obtiene por suma de las series base (${sinSexo ? 'por entidad' : 'por entidad y sexo'}), cada una calculada con **${baseMotor}** (repite los casos de 52 semanas antes)`
      : `calculado con **${MOTOR_ES[serieRef?.motor] || baseMotor}** (repite los casos de 52 semanas antes)`;
    const pocoInf = r.controlEstatalPocoInformativo && comp.smape_bases
      ? ` Por estado es una referencia poco informativa: su error en ${AMBITO_CONTROL.smape_bases(sinSexo)} fue sMAPE ${uno(comp.smape_bases.control)} en esa prueba.`
      : '';
    const aut = r.controlDelegado ? 'por un dictamen tomado bajo delegación del autor' : 'por autorización del autor';
    return `Lo publicado corresponde al **control estacional, no validado** (${comoSerie}) [1]. ` +
      `El portafolio de modelos seleccionado fue rechazado en la prueba única retrospectiva de **${m.anio}** porque ${globalThis.EPI_CATALOGO.motivoRechazo((caida.comprobaciones || []).filter((c) => !c.pasa).map((c) => ({ nombre: AMBITO_CONTROL[c.ambito](sinSexo), portafolio: c.portafolio, control: c.control })))}, y ${aut} se publica el control estacional; **el rechazado fue el portafolio seleccionado, no el control publicado** [1]. ` +
      `Como control estacional no tiene validación prospectiva que superar: el avance **${m.wa} de ${m.wr}** semanas (**${v.verdict}**) es únicamente un contador técnico de registro con cada boletín, no un indicador de calidad ni una validación en curso [1]. ` +
      `Error del control en aquella prueba retrospectiva de ${m.anio} (distinta de la vista de ${v.origin[0]}, sMAPE): ${lista(errs)}.${pocoInf}`;
  }
  if (v.portafolio_igual_al_control === true) {
    return `Lo publicado corresponde al **control estacional, no validado** (repite los casos de 52 semanas antes) [1]. ` +
      `${globalThis.EPI_CATALOGO.textoSinAlternativa(r.id, sinSexo).replace(/^Es el control estacional, no validado: cada semana repite los casos de 52 semanas antes\. /, '')} ` +
      `El avance **${m.wa} de ${m.wr}** semanas (**${v.verdict}**) es sólo un contador técnico de registro, no una validación en curso [1].`;
  }
  const motorTxt = serieRef ? `Motor de la serie: **${MOTOR_ES[serieRef.motor] || serieRef.motor}** [1]. ` : '';
  let prosp;
  if (m.wa === 0 && v.verdict === 'INCOMPLETE') {
    prosp = `la validación prospectiva está en curso (0 de ${m.wr} semanas observadas tras el origen; pronóstico aún no validado)`;
  } else if (v.verdict === 'INCOMPLETE') {
    prosp = `la validación prospectiva está en curso con **${m.wa} de ${m.wr}** semanas observadas (veredicto **INCOMPLETE**; pronóstico aún no validado, sin fallo del portafolio)`;
  } else if (v.verdict === 'PASS') {
    prosp = `la validación prospectiva completó **${m.wa} de ${m.wr}** semanas (veredicto **PASS**)`;
  } else if (v.verdict === 'FAIL') {
    prosp = `la validación prospectiva registró **${m.wa} de ${m.wr}** semanas con veredicto **FAIL** (el pronóstico no superó la validación prospectiva)`;
  } else {
    prosp = `la validación prospectiva registra **${m.wa} de ${m.wr}** semanas (veredicto **${v.verdict}**)`;
  }
  return `${motorTxt}Su portafolio de modelos fue **aceptado en la prueba única retrospectiva de ${m.anio}**${prueba ? `: ${prueba.frase}` : '.'} Esa prueba retrospectiva no equivale a la validación del pronóstico publicado: ${prosp} [1].`;
}
