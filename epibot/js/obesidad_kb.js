/**
 * obesidad_kb.js — respuestas del EpiBot sobre los releases publicados, desde su vista.
 *
 * Nació para Obesidad (C7.7) y hoy atiende también Diabetes tipo I y II. Una vista sin semanas
 * observadas (validación prospectiva 0/4) no tiene desempeño: nunca se muestran métricas vacías.
 *
 * Extraído de kb.js. El tipo de respuesta lo decide `tipoEfectivo` (obesidad_charts.js), el mismo
 * que usa la gráfica; la respuesta lleva un marcador `<!--OBESIDAD:{...}-->` con el tipo, la
 * geografía y el sexo resueltos, para que app.js dibuje exactamente lo que dice el texto también en
 * follow-ups («¿y hombres?») y en consultas corregidas por typo, donde la consulta cruda ya no
 * nombra a Obesidad.
 */
import { mencionaNoModelada } from './entities.js?v=87';
import {
  MOTOR_NOMBRE as OBESIDAD_MOTOR, tipoEfectivo, NO_DISPONIBLE,
  serieObesidad, estadosEnConsulta, emisionTxt, noDisponible, alternativas,
} from './obesidad_charts.js?v=57';
import { releaseConAlias, releaseDePad, releaseDeId } from './release_config.js?v=54';
// Avisos de la fuente de los doce controles de alta20c (generado por avisos_controles12.py del backend).
import './avisos_fuente.js?v=5';
import { respuestaLlana, siguientes, confiabilidad, enlaceDefinicion, indicadores, nombreEstado } from './resumen_llano.js?v=2';
import { DEFINICIONES } from './definiciones.js?v=1';

const any = (q, ks) => ks.some((k) => q.includes(k));
const semana = ([a, w]) => `${a}-W${String(w).padStart(2, '0')}`;
const num1 = (n) => (n == null ? '—' : Number(n).toLocaleString('es-MX', { maximumFractionDigits: 1, minimumFractionDigits: 1 }));
const ent0 = (n) => (n == null ? '—' : Math.round(n).toLocaleString('es-MX'));
const mediana = (xs) => { const o = [...xs].sort((a, b) => a - b); const m = o.length >> 1; return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2; };
const SEXO_TXT = { general: 'ambos sexos', hombres: 'hombres', mujeres: 'mujeres' };

function motorDe(v, x) {
  if (x.nivel === 'estado' && x.motor === 'portfolio') {
    // La serie General de un estado no se modela: es la suma de sus series de hombres y mujeres.
    const m = (sx) => { const y = v.series[`estado|${x.id}|${sx}`]; return OBESIDAD_MOTOR[y?.motor] || y?.motor || '—'; };
    return `suma de hombres (${m('hombres')}) y mujeres (${m('mujeres')})`;
  }
  return OBESIDAD_MOTOR[x.motor] || x.motor;
}

function ficha(v, x, encabezado, r) {
  const lugar = x.nivel === 'nacional' ? 'Nacional' : x.nombre;
  const inicio = [
    `**${r.etiqueta} · ${lugar} · ${x.sexo_nombre}${encabezado ? ` · ${encabezado}` : ''}**`,
    '',
    `Pronóstico **congelado**: datos hasta ${semana(v.origin)}, ${emisionTxt(v)}, ${v.horizon_weeks} semanas, sin reentrenar; motor: ${motorDe(v, x)}.`,
    '',
    // Lo que acota la afirmación prospectiva de este release (p. ej. un boletín ya público al emitir).
    ...(r.cronologia ? [r.cronologia, ''] : []),
  ];
  if (!x.oos.semanas) return [...inicio, enCurso(v), ...avisosFuente(v.disease_id)];
  return [
    ...inicio,
    ...(esControl(v) ? [avisoDeControl(v), ''] : []),
    `**Cómo le ha ido fuera de muestra** (${x.oos.semanas === 1 ? '1 semana observada' : `${x.oos.semanas} semanas observadas`}, hasta ${semana(v.observation_cutoff)}):`,
    `- sMAPE: **${num1(x.oos.smape)} %**`,
    `- Error medio absoluto: ${ent0(x.oos.mae)} casos por semana`,
    `- Sesgo: ${num1(x.oos.sesgo_pct)} % (observados ${ent0(x.oos.observado_total)} frente a ${ent0(x.oos.pronostico_total)} pronosticados)`,
    ...avisosFuente(v.disease_id),
  ];
}

/**
 * Avisos de la fuente del release (valores retirados o conservados y la nota medida de bajas del acumulado),
 * tal como los dice su ficha. Sólo los doce controles de alta20c los tienen; los demás no reciben nada.
 */
export function avisosFuente(id) {
  const a = (globalThis.EPI_AVISOS_FUENTE || {})[id];
  if (!a) return [];
  return ['', '**Avisos de la fuente:**', ...[...a.avisos, a.nota].filter(Boolean).map((x) => `- **${x.titulo}** ${x.texto}`)];
}

/**
 * Lo publicado es el control porque el gate rechazó el portafolio. Las cifras salen de la vista,
 * que las toma del veredicto sellado; decirlo como validación sería falso.
 */
function avisoControl(v) {
  const r = rechazoDe(v);
  return `**Es el control estacional, no validado:** cada semana repite los casos de 52 semanas antes. El portafolio seleccionado se rechazó en la prueba de ${r.anio} porque ${r.motivo}, así que no hay una validación prospectiva que superar: sólo se registrará su error con cada boletín. ${r.errorControl}`;
}

/**
 * alta_b44 (19-nov-2026): con un año de historia (rolling_cv_historia_corta_2024_v1) el único candidato fue el control y
 * el portafolio es idéntico a él (`portafolio_igual_al_control`). Se presenta como control estacional publicado, no
 * validado, nunca como «validación en curso»; su error en la prueba única sale del catálogo (`pruebaSinAlternativa`,
 * tomado del acceptance.json sellado).
 */
export const esControl = (v) => !!v?.caida_al_control || v?.portafolio_igual_al_control === true;
export const ETIQUETA_SIN_ALTERNATIVA = globalThis.EPI_CATALOGO.ETIQUETA_SIN_ALTERNATIVA;
/** Etiqueta visible: la sellada, salvo un portafolio igual al control (misma frase que assets/dashboard/unified.mjs). */
export const etiquetaVisible = (v) => (v?.portafolio_igual_al_control === true ? ETIQUETA_SIN_ALTERNATIVA : v.publication_label);

function avisoSinAlternativa(v) {
  const sinSexo = !Object.keys(v.series || {}).some((k) => k.endsWith('|hombres'));
  return globalThis.EPI_CATALOGO.textoSinAlternativa(v.disease_id, sinSexo)
    .replace(/^Es el control estacional, no validado:/, '**Es el control estacional, no validado:**');
}

/** Aviso de un release del control: caída tras rechazo o control sin alternativa. */
export const avisoDeControl = (v) => (v.caida_al_control ? avisoControl(v) : avisoSinAlternativa(v));

const AMBITO = {
  smape_bases: (sinSexo) => (sinSexo ? 'las series por estado' : 'las series por estado y sexo'),
  smape_all: () => 'el conjunto de las series publicadas',
  smape_nacional_general: () => 'el total nacional',
};

/**
 * Año y ámbitos del rechazo, desde la vista sellada: la prueba es 2025 en las series largas y
 * 2026 en las de historia corta, y no siempre falla el nacional.
 */
export function rechazoDe(v) {
  const c = v.caida_al_control;
  const anio = String(c.fold || '').replace(/^test_/, '') || '2025';
  const sinSexo = !Object.keys(v.series || {}).some((k) => k.endsWith('|hombres'));
  const fallas = c.comprobaciones.filter((x) => !x.pasa);
  const partes = fallas.map((x) => `${AMBITO[x.ambito]?.(sinSexo) || x.ambito} (sMAPE ${num1(x.portafolio)} frente a ${num1(x.control)} del control)`);
  const ambitos = partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}` : partes[0] || 'el criterio de aceptación';
  const pocoInformativo = !!releaseDeId(v.disease_id)?.controlEstatalPocoInformativo;
  const motivo = globalThis.EPI_CATALOGO.motivoRechazo(fallas.map((x) => ({ nombre: AMBITO[x.ambito]?.(sinSexo) || x.ambito,
    portafolio: x.portafolio, control: x.control })));
  return { anio, ambitos, motivo, errorControl: errorDelControl(c, anio, sinSexo, pocoInformativo) };
}

/**
 * Error del propio control en los tres ámbitos de la prueba, haya fallado o no cada uno: si sólo falló
 * el nacional, una consulta por estado no puede quedarse con la cifra nacional como única referencia.
 * Sin umbral genérico: la advertencia estatal sólo la llevan los releases que la declaran en el
 * catálogo (`controlEstatalPocoInformativo`), con la cifra medida y sin atribuirle causa.
 */
export function errorDelControl(c, anio, sinSexo, estatalPocoInformativo = false) {
  const de = (amb) => c.comprobaciones.find((x) => x.ambito === amb)?.control;
  const partes = ['smape_bases', 'smape_all', 'smape_nacional_general']
    .filter((amb) => de(amb) != null)
    .map((amb) => `${num1(de(amb))} en ${AMBITO[amb](sinSexo)}`);
  if (!partes.length) return '';
  const lista = partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}` : partes[0];
  const aviso = estatalPocoInformativo && de('smape_bases') != null
    ? ` Por estado es una referencia poco informativa: su error en ${AMBITO.smape_bases(sinSexo)} fue sMAPE ${num1(de('smape_bases'))} en esa prueba.`
    : '';
  return `Error del control en la prueba de ${anio} (sMAPE): ${lista}.${aviso}`;
}

/** Estado de una validación sin semanas observadas: se dice, no se rellena con cifras. */
const enCurso = (v) => (esControl(v) ? avisoDeControl(v) : `**Validación prospectiva en curso** (${v.weeks_available} de ${v.weeks_required} semanas): todavía no hay semanas observadas después del origen, así que aún no se publica su desempeño fuera de muestra.`);

/** Desempeño de una fila, o lo que hay mientras no exista ninguna semana observada. */
const desempeno = (x, v) => (x.oos.semanas
  ? `sMAPE ${num1(x.oos.smape)} %, sesgo ${num1(x.oos.sesgo_pct)} %, ${ent0(x.pronostico_52_total)} casos en ${v.horizon_weeks} semanas`
  : `${ent0(x.pronostico_52_total)} casos pronosticados en ${v.horizon_weeks} semanas`);

/** Marcador para app.js: la gráfica sigue al texto aunque la consulta cruda no diga «obesidad». */
const marca = (tipo, ent, estados, r) => `\n<!--${r.marca}:${JSON.stringify({ tipo, estado: ent.estado || null, sexo: ent.sexo || null, estados: estados || null })}-->`;

export function answerObesidad(q, ent, s, d) {
  // El release con alias lo nombra la consulta o lo trae el contexto (follow-up) o la corrección
  // de typos. El nombre del handler se conserva porque lo fijan los casos de prueba.
  const delContexto = releaseDePad(ent.padecimiento);
  const r = releaseConAlias(q) || (delContexto?.alias.length ? delContexto : null);
  return r ? answerRelease(q, ent, s, d, r) : null;
}

export function answerDiabetes(q, ent, s, d) {
  const r = releaseDePad(ent.padecimiento);
  if (!r || r.alias.length) return null;
  const respuesta = answerRelease(q, ent, s, d, r);
  if (!respuesta || !ent._diabetesGenerica) return respuesta;
  return `Tomo «diabetes» como **${r.etiqueta}**, que concentra la gran mayoría de los casos notificados. Para tipo 1, pregunta por «diabetes tipo 1».\n\n${respuesta}`;
}

/**
 * Consultas que nombran varios padecimientos y al menos un release («comparar obesidad con
 * diabetes tipo 2»). Cada uno tiene su corte y sus motores: se dan sus totales y ninguna gráfica.
 */
export function answerReleasesMixtos(q, ent, s, d) {
  const pads = ent.padecimientos || [];
  if (pads.length < 2 || !pads.some(releaseDePad) || mencionaNoModelada(q)) return null;
  // Decimosexta auditoría: con un id sensible entre los padecimientos, nunca se combinan cifras (guarda mixta compartida).
  if (pads.some((p) => releaseDePad(p)?.sensible)) {
    return globalThis.EPI_CATALOGO.respuestaMixtaSensible(q) ||
      'No combino en una misma respuesta las cifras de estos padecimientos; pregúntalos por separado.\n\n' +
      'Si tú o alguien cercano necesita apoyo, la **Línea de la Vida** atiende gratis, las 24 horas, todos los días: **800 911 2000**. ' +
      'Si alguien está en peligro inmediato, llama al **911**.\n<!--SIN_GRAFICA-->';
  }
  const filas = pads.map((pad) => {
    const r = releaseDePad(pad);
    if (!r) return `- **${pad}**: pregunta por este padecimiento por separado.`;
    const v = d[r.dataKey];
    // Con un estado pedido, sólo la serie de ese estado; nunca el total nacional en su lugar.
    let x = v && !ent.estado ? v.series['nacional|mx|general'] : null;
    if (v && ent.estado) { const y = serieObesidad(v, { ...ent, sexo: 'general' }); x = y && y.nivel === 'estado' ? y : null; }
    const lugar = ent.estado && x ? ` en ${nombreEstado(x.nombre)}` : ' en el país';
    if (!x) return `- **${r.etiqueta}**: consulta [su página](../${r.pagina})${ent.estado ? ` para ${ent.estado}` : ''}.`;
    const ind = indicadores(v, x);
    const TEND = { sube: 'se espera que suba', baja: 'se espera que baje', estable: 'estable', incierto: 'sin señal clara', atipico: 'notificación atípica', pocos: 'muy pocos casos' };
    if (!ind || ind.F4 == null) return `- **${r.etiqueta}**${lugar}: ${ent0(x.pronostico_52_total)} casos pronosticados en ${v.horizon_weeks} semanas. [Ver su página](../${r.pagina}).`;
    return `- **${r.etiqueta}**${lugar}: ${ent0(ind.O4)} casos en las últimas 4 semanas; unos ${ent0(ind.F4)} en las próximas 4 (${TEND[ind.tendencia]}, confiabilidad ${confiabilidad(v, x, esControl(v)).nivel}). [Ver su página](../${r.pagina}).`;
  });
  return ['Cada padecimiento tiene su propio pronóstico, así que los doy por separado:', '', ...filas, '<!--SIN_GRAFICA-->'].join('\n');
}

function answerRelease(q, ent, s, d, r) {
  // Si la pregunta nombra además otro padecimiento, modelado o no, la responde su handler.
  if (ent.padecimiento && ent.padecimiento !== r.pad) return null;
  if ((ent.padecimientos || []).some((p) => p !== r.pad)) return null;
  if (mencionaNoModelada(q)) return null;
  const v = d[r.dataKey];
  if (!v) {
    return `No pude cargar los datos de **${r.etiqueta}** en este momento. Puedes consultarlos en ` +
      `[la página de ${r.nombre}](../${r.pagina}) o volver a preguntar en unos segundos.`;
  }
  // Sin desglose por sexo (cuello del útero): sólo existe el total de cada entidad.
  const sinSexo = !Object.keys(v.series).some((k) => k.endsWith('|hombres'));
  // El nombre del padecimiento no cuenta para la intención («vehículos con motor» no pide los motores).
  const qTipo = [r.nombre, r.consulta, ...(r.alias || [])].map((a) => String(a).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())
    .sort((a, b) => b.length - a.length).reduce((acc, a) => (a && a.length > 3 ? acc.split(a).join(' ') : acc), q);
  let tipoPedido = tipoEfectivo(qTipo, ent);
  // Dos estados nombrados («compárame candidiasis entre CDMX y Edomex») piden la comparación.
  if (tipoPedido === 'serie' && estadosEnConsulta(v, q).length >= 2) tipoPedido = 'comparador';
  const pidioSexo = sinSexo && ((ent.sexo && ent.sexo !== 'general') || tipoPedido === 'sexo');
  if (sinSexo) ent = { ...ent, sexo: undefined };
  const tipo = pidioSexo && tipoPedido === 'sexo' ? tipoEfectivo('', ent) : tipoPedido;
  const etiqueta = `_${etiquetaVisible(v)}._`;
  const avisoSexo = pidioSexo
    ? `El boletín publica **${r.etiqueta}** sin desglose por sexo: se pronostica el total de cada entidad.\n\n`
    : '';
  const pie = `\n\nGráfica interactiva por estado${sinSexo ? '' : ' y sexo'}: [${r.nombre} · pronóstico semanal](../${r.pagina}).`;
  const sexo = ent.sexo || 'general';
  const sexoTxt = SEXO_TXT[sexo];
  const est = Object.values(v.series).filter((x) => x.nivel === 'estado' && x.sexo === sexo && x.oos.smape != null);
  const nOos = est[0]?.oos.semanas ?? 0;
  const oosTxt = `${nOos === 1 ? '1 semana observada' : `${nOos} semanas observadas`} tras el origen ${semana(v.origin)}`;
  const fin = (lineas, estados) => avisoSexo + lineas.join('\n') + pie + marca(tipo, ent, estados, r);
  const conOos = est.length > 0;
  const pideError = any(q, ['error', 'smape', 'precision', 'sesgo', 'desempeno']);

  if (tipo in NO_DISPONIBLE) {
    const texto = tipo === 'metricas' && esControl(v) ? avisoDeControl(v) : noDisponible(tipo, r.nombre, r.seleccion);
    return `${texto}\n\nPara ${r.etiqueta} sí puedes pedir ${alternativas(r, conOos)}.` + pie + marca(tipo, ent, null, r);
  }

  if (!conOos && (['ranking', 'calibracion', 'volumen_error'].includes(tipo) || (tipo === 'mapa' && pideError))) {
    return fin([`**${r.etiqueta}: aún no hay desempeño que mostrar.**`, '', enCurso(v), '', ...(r.cronologia ? [r.cronologia, ''] : []),
      `Sí puedes pedir ${alternativas(r, false)}.`, '', etiqueta]);
  }

  if (tipo === 'ranking') {
    const orden = [...est].sort((a, b) => a.oos.smape - b.oos.smape);
    const linea = (x, i) => `${i + 1}. **${x.nombre}**: sMAPE ${num1(x.oos.smape)} % (sesgo ${num1(x.oos.sesgo_pct)} %)`;
    return fin([
      `**${r.etiqueta}: desempeño fuera de muestra por estado, ${sexoTxt}** (${oosTxt}).`, '',
      '**Más precisos:**', ...orden.slice(0, 5).map(linea),
      '', '**Menos precisos:**', ...orden.slice(-5).reverse().map((x, i) => linea(x, orden.length - 1 - i)),
      '', etiqueta,
    ]);
  }

  if (tipo === 'mapa' || tipo === 'entidades') {
    if (tipo === 'mapa' && pideError) {
      const orden = [...est].sort((a, b) => b.oos.smape - a.oos.smape).slice(0, 5);
      return fin([`**${r.etiqueta}: mapa del sMAPE fuera de muestra, ${sexoTxt}** (${oosTxt}).`, '',
        `Mediana estatal: **${num1(mediana(est.map((x) => x.oos.smape)))} %**. Estados con mayor error:`,
        ...orden.map((x) => `- **${x.nombre}**: ${num1(x.oos.smape)} %`), '', etiqueta]);
    }
    // Rediseño conversacional: los estados con más casos esperados (o con mayor aumento, si se pide), con lo observado.
    const todos = Object.values(v.series).filter((x) => x.nivel === 'estado' && x.sexo === sexo)
      .map((x) => ({ x, ind: indicadores(v, x) })).filter((y) => y.ind && y.ind.F4 != null);
    const pideAumento = /\b(incremento|aumento|subiendo|suben|crece|crecen)\b/.test(q);
    const pideAcum = /\b(acumulad\w*|en lo que va|este ano|en el ano)\b/.test(q);
    const orden = [...todos].sort(pideAumento
      ? (a, b) => (b.ind.F4 - b.ind.O4) - (a.ind.F4 - a.ind.O4)
      : pideAcum ? (a, b) => b.ind.ytd - a.ind.ytd : (a, b) => b.ind.F4 - a.ind.F4).slice(0, /top 10/.test(q) ? 10 : 5);
    const fila = ({ x, ind }) => pideAcum
      ? `- **${nombreEstado(x.nombre)}**: ${ent0(ind.ytd)} casos en lo que va de ${ind.anio}.`
      : `- **${nombreEstado(x.nombre)}**: unos ${ent0(ind.F4)} casos en las próximas 4 semanas (${ent0(ind.O4)} en las 4 anteriores).`;
    const titulo = pideAumento ? 'estados donde más se espera que aumente' : pideAcum ? 'estados con más casos en lo que va del año' : 'estados con más casos esperados';
    const nac = v.series[`nacional|mx|${sexo}`];
    return fin([`**${r.etiqueta}: ${titulo}, ${sexoTxt}**`, '', ...orden.map(fila), '',
      '_Casos notificados, sin ajustar por población: un estado más poblado tiene más casos aunque su riesgo no sea mayor._',
      '<!--DETALLE-->', `Total nacional pronosticado en ${v.horizon_weeks} semanas: **${ent0(nac.pronostico_52_total)} casos**.`, '', etiqueta, `_${v.uncertainty_label}._`],
    orden.map((y) => y.x.nombre));
  }

  if (tipo === 'calibracion' || tipo === 'volumen_error') {
    const bajo = est.filter((x) => x.oos.sesgo_pct < 0).length;
    const nac = v.series[`nacional|mx|${sexo}`];
    const cal = tipo === 'calibracion';
    return fin([`**${r.etiqueta}: ${cal ? 'calibración por estado' : 'volumen observado frente a error'}, ${sexoTxt}** (${oosTxt}).`, '',
      `- Nacional: sMAPE **${num1(nac.oos.smape)} %**, sesgo ${num1(nac.oos.sesgo_pct)} %.`,
      `- Mediana estatal del sMAPE: ${num1(mediana(est.map((x) => x.oos.smape)))} %.`,
      `- El pronóstico acumulado queda por debajo de lo observado en **${bajo} de ${est.length}** estados.`,
      '', cal
        ? 'Cada punto es un estado: suma pronosticada frente a suma observada en esas semanas. Sobre la diagonal coinciden los **totales acumulados**; errores semanales de signo contrario pueden compensarse, por eso el error semanal se mide con el sMAPE.'
        : 'Cada punto es un estado: casos observados frente a su sMAPE.',
      '', etiqueta]);
  }

  if (tipo === 'motores') {
    const cuenta = Object.entries(v.engines).sort((a, b) => b[1] - a[1]);
    return fin([`**${r.etiqueta}: motores del release** \`${v.release_id}\``, '',
      sinSexo
        ? `Se modelan **${v.models} series**, una por estado (el boletín no desglosa sexo); los otros ${v.products - v.models} de los ${v.products} productos (regionales y nacional) se obtienen sumándolas.`
        : `Se modelan **${v.models} series** (32 estados × hombres y mujeres); los otros ${v.products - v.models} de los ${v.products} productos (totales estatales, regionales y nacional) se obtienen sumándolas.`, '',
      ...cuenta.map(([m, n]) => `- ${OBESIDAD_MOTOR[m] || m}: **${n}** series`), '',
      esControl(v) ? avisoDeControl(v) : `El motor de cada serie se eligió con validación cruzada temporal ${r.seleccion || 'en pliegues de 2021 a 2024'}, sin que el modelo vea nunca el periodo que pronostica.`,
      sinSexo
        ? `Pregunta por un estado («motor de ${r.consultaVisible || r.consulta} en Jalisco») para ver el de esa serie.`
        : `Pregunta por un estado y un sexo («motor de ${r.consultaVisible || r.consulta} en Jalisco mujeres») para ver el de esa serie.`, '', etiqueta]);
  }

  if (tipo === 'comparador') {
    let nombres = estadosEnConsulta(v, q);
    const top = nombres.length < 2;
    if (top) nombres = Object.values(v.series).filter((x) => x.nivel === 'estado' && x.sexo === 'general').sort((a, b) => b.pronostico_52_total - a.pronostico_52_total).slice(0, 5).map((x) => x.nombre);
    const filas = nombres.slice(0, 6).map((n) => Object.values(v.series).find((x) => x.nivel === 'estado' && x.sexo === sexo && x.nombre === n)).filter(Boolean);
    // Rediseño conversacional: la comparación dice casos recientes, lo esperado y la tendencia; el error queda en la ficha.
    const TEND = { sube: 'va a subir', baja: 'va a bajar', estable: 'estable', incierto: 'sin señal clara', atipico: 'notificación atípica', pocos: 'muy pocos casos' };
    const llana = (x) => {
      const ind = indicadores(v, x);
      if (!ind || ind.F4 == null) return `- **${nombreEstado(x.nombre)}**: ${desempeno(x, v)}`;
      const vs = !ind.O4py ? '' : Math.round(Math.abs(ind.O4 / ind.O4py - 1) * 100) === 0 ? ', igual que hace un año' : ind.O4py ? `, ${ind.O4 >= ind.O4py ? `${Math.round((ind.O4 / ind.O4py - 1) * 100)} % más` : `${Math.round((1 - ind.O4 / ind.O4py) * 100)} % menos`} que hace un año` : '';
      return `- **${nombreEstado(x.nombre)}**: ${ent0(ind.O4)} casos en las últimas 4 semanas${vs}; se esperan unos ${ent0(ind.F4)} en las próximas 4 (${TEND[ind.tendencia]}; confiabilidad ${confiabilidad(v, x, esControl(v)).nivel}).`;
    };
    return fin([`**${r.etiqueta}: comparación de estados, ${sexoTxt}**${top ? ' (los cinco con más casos esperados; nombra dos o más estados para compararlos)' : ''}`, '',
      ...filas.map(llana), '', '_Casos notificados, sin ajustar por población. Pregunta «¿qué tan confiable es?» para ver el detalle de la confiabilidad._', '<!--DETALLE-->',
      ...filas.map((x) => `- **${nombreEstado(x.nombre)}**: ${desempeno(x, v)}`),
      '', etiqueta], filas.map((x) => x.nombre));
  }

  const x = serieObesidad(v, ent);
  if (!x) return null;

  if (tipo === 'sexo') {
    const base = x.nivel === 'nacional' ? 'nacional|mx' : `estado|${x.id}`;
    const lugar = x.nivel === 'nacional' ? 'en el país' : `en ${nombreEstado(x.nombre)}`;
    const h = v.series[`${base}|hombres`], m = v.series[`${base}|mujeres`];
    const ih = indicadores(v, h), im = indicadores(v, m);
    const tot = (ih?.O4 || 0) + (im?.O4 || 0);
    const pct = (a) => (tot ? Math.round(a / tot * 100) : 0);
    const fila = (nombre, i) => `- **${nombre}**: ${ent0(i.O4)} casos en las últimas 4 semanas (${pct(i.O4)} %); se esperan unos ${ent0(i.F4)} en las próximas 4.`;
    return fin([`**${r.etiqueta} ${lugar}: hombres y mujeres**`, '', fila('Mujeres', im), fila('Hombres', ih), '',
      '<!--DETALLE-->', `- Hombres: ${desempeno(h, v)} (${motorDe(v, h)})`, `- Mujeres: ${desempeno(m, v)} (${motorDe(v, m)})`, '', etiqueta]);
  }

  if (tipo === 'acumulado') {
    const ind = indicadores(v, x);
    const lugar = x.nivel === 'nacional' ? 'en el país' : `en ${nombreEstado(x.nombre)}`;
    const resto = ind ? ind.fut.filter(([ds]) => ds.startsWith(ind.anio)).reduce((a, [, y]) => a + y, 0) : 0;
    const vs = ind?.ytdPrevio ? `, ${ind.ytd >= ind.ytdPrevio ? `${Math.round((ind.ytd / ind.ytdPrevio - 1) * 100)} % más` : `${Math.round((1 - ind.ytd / ind.ytdPrevio) * 100)} % menos`} que a la misma fecha de ${Number(ind.anio) - 1}` : '';
    const tasa = /\b(tasa|por 100 ?mil|incidencia)\b/.test(q) ? ['', '_No calculo tasas por 100 mil habitantes: el boletín reporta casos notificados._'] : [];
    return fin([`**${r.nombre} ${lugar}: ${ent0(ind?.ytd)} casos en lo que va de ${ind?.anio}**${vs}.`,
      ...(resto ? ['', `Para lo que resta del año se esperan unos ${ent0(resto)} casos más.`] : []), ...tasa, '',
      '<!--DETALLE-->', ...ficha(v, x, 'acumulado', r), '', `Acumulado de las ${v.horizon_weeks} semanas del pronóstico: **${ent0(x.pronostico_52_total)} casos**.`, '', etiqueta]);
  }

  // Rediseño conversacional (24-nov-2026): la consulta general, la de confiabilidad y la de «qué es» responden primero en
  // lenguaje llano; la ficha técnica queda plegada después de <!--DETALLE--> («Cómo se calculó»).
  if (tipo === 'serie' || tipo === 'confianza') {
    const estadosMismoSexo = Object.values(v.series).filter((y) => y.nivel === 'estado' && y.sexo === x.sexo);
    const llano = respuestaLlana({ v, x, r, q, esControl: esControl(v), estados: estadosMismoSexo, sinSexo });
    if (llano) {
      const qn = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const defin = /^\W*(que|q) (es|son|significa)\b|\bque es (la|el|una|un)\b|\bsignifica\b|\bdefin/.test(qn);
      const completo = (v.nombre_completo || '').replace(/\s*\([^()]+\)\s*$/, '').trim();
      const cie = (v.nombre_completo || '').match(/\(([^()]+)\)\s*$/)?.[1];
      const arriba = [];
      if (defin) {
        // Rediseño conversacional: definición propia en lenguaje llano (js/definiciones.js, revisada por un médico),
        // con la aclaración de que es informativa y el enlace a MedlinePlus en español para saber más.
        const def = DEFINICIONES[r.id];
        arriba.push(def
          ? `**${r.nombre}**${cie ? ` (CIE-10 ${cie})` : ''}. ${def}`
          : `**${r.nombre}** es una de las categorías que notifica el boletín epidemiológico de la Secretaría de Salud` +
            `${cie ? ` (CIE-10 ${cie})` : ''}${completo && completo.toLowerCase() !== r.nombre.toLowerCase() ? `: ${completo}` : ''}.`, '',
          `_Información general, no sustituye la consulta médica. Para saber más: [MedlinePlus en español](${enlaceDefinicion(r.nombre)})._ Así va:`, '');
      }
      if (tipo === 'confianza') arriba.push(confiabilidad(v, x, esControl(v)).texto, '');
      const tecnico = ficha(v, x, '', r);
      const futurasT = x.pronostico.filter(([ds]) => ds > v.observation_cutoff_ds).slice(0, 4);
      if (futurasT.length) tecnico.push('', '**Siguientes semanas del pronóstico, aún sin observación publicada:**', ...futurasT.map(([ds, y]) => `- Semana del ${ds}: ${ent0(y)} ${ent0(y) === '1' ? 'caso' : 'casos'}`));
      tecnico.push('', `Total pronosticado en las ${v.horizon_weeks} semanas: **${ent0(x.pronostico_52_total)} casos**.`, '', etiqueta, `_${v.uncertainty_label}._`);
      const cuerpo = tipo === 'confianza' ? llano.filter((l) => !/^\*\*Confiabilidad/.test(l)) : llano;
      // Tema sensible: el aviso con la Línea de la Vida va siempre a la vista, nunca plegado en la ficha técnica.
      if (r.sensible) {
        cuerpo.push('', '**Tema sensible.** Esta serie cuenta casos notificados al sistema de vigilancia y no describe métodos ni ' +
          'circunstancias. Si tú o alguien cercano necesita apoyo, la **Línea de la Vida** atiende gratis, las 24 horas: ' +
          '**800 911 2000**; si alguien está en peligro inmediato, llama al **911**.');
      }
      return avisoSexo + [...arriba, ...cuerpo].join('\n') + pie + '\n\n<!--DETALLE-->\n' + tecnico.join('\n') +
        marca(tipo === 'confianza' ? 'serie' : tipo, ent, null, r) + siguientes(r, x, sinSexo);
    }
  }

  const encabezado = { seguimiento: 'zoom semanal', motor_serie: 'motor' }[tipo] || '';
  const lineas = ficha(v, x, encabezado, r);
  if (tipo === 'motor_serie') lineas.splice(2, 0, `El motor de esta serie es **${motorDe(v, x)}**.`, '');
  if (tipo === 'seguimiento') {
    const obs = new Map(x.observado);
    const ult = x.pronostico.filter(([ds]) => obs.has(ds)).slice(-4);
    if (ult.length) lineas.push('', '**Últimas semanas observadas frente al pronóstico:**', ...ult.map(([ds, y]) => `- Semana del ${ds}: observado ${ent0(obs.get(ds))}, pronóstico ${ent0(y)}`));
  }
  const futuras = x.pronostico.filter(([ds]) => ds > v.observation_cutoff_ds).slice(0, 4);
  if (futuras.length) {
    lineas.push('', '**Siguientes semanas del pronóstico, aún sin observación publicada:**', ...futuras.map(([ds, y]) => `- Semana del ${ds}: ${ent0(y)} ${ent0(y) === '1' ? 'caso' : 'casos'}`));
  }
  lineas.push('', `Total pronosticado en las ${v.horizon_weeks} semanas: **${ent0(x.pronostico_52_total)} casos**.`, '', etiqueta, `_${v.uncertainty_label}._`);
  if (tipo === 'banda') lineas.push('', `${r.nombre} se publica **sin intervalos**: la gráfica muestra sólo el pronóstico puntual, no un corredor ni una banda de confianza.`);
  return fin(lineas);
}

