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
import { mencionaNoModelada } from './entities.js?v=37';
import {
  MOTOR_NOMBRE as OBESIDAD_MOTOR, tipoEfectivo, NO_DISPONIBLE,
  serieObesidad, estadosEnConsulta, emisionTxt, noDisponible, alternativas,
} from './obesidad_charts.js?v=5';
import { releaseConAlias, releaseDePad } from './release_config.js?v=3';

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
  ];
  if (!x.oos.semanas) return [...inicio, enCurso(v)];
  return [
    ...inicio,
    `**Cómo le ha ido fuera de muestra** (${x.oos.semanas} semanas observadas, hasta ${semana(v.observation_cutoff)}):`,
    `- sMAPE: **${num1(x.oos.smape)} %**`,
    `- Error medio absoluto: ${ent0(x.oos.mae)} casos por semana`,
    `- Sesgo: ${num1(x.oos.sesgo_pct)} % (observados ${ent0(x.oos.observado_total)} frente a ${ent0(x.oos.pronostico_total)} pronosticados)`,
  ];
}

/** Estado de una validación sin semanas observadas: se dice, no se rellena con cifras. */
const enCurso = (v) => `**Validación prospectiva en curso** (${v.weeks_available} de ${v.weeks_required} semanas): todavía no hay semanas observadas después del origen, así que aún no se publica su desempeño fuera de muestra.`;

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
  const filas = pads.map((pad) => {
    const r = releaseDePad(pad);
    const nac = r && d[r.dataKey]?.series['nacional|mx|general'];
    if (!r) return `- **${pad}**: pregunta por este padecimiento por separado.`;
    if (!nac) return `- **${r.etiqueta}**: consulta [su página](../${r.pagina}).`;
    return `- **${r.etiqueta}**: ${ent0(nac.pronostico_52_total)} casos pronosticados en ${d[r.dataKey].horizon_weeks} semanas, con datos hasta ${semana(d[r.dataKey].origin)}. [Ver su página](../${r.pagina}).`;
  });
  return ['Cada padecimiento tiene su propio pronóstico congelado, así que no los mezclo en una gráfica:', '', ...filas, '<!--SIN_GRAFICA-->'].join('\n');
}

function answerRelease(q, ent, s, d, r) {
  // Si la pregunta nombra además otro padecimiento, modelado o no, la responde su handler.
  if (ent.padecimiento && ent.padecimiento !== r.pad) return null;
  if ((ent.padecimientos || []).some((p) => p !== r.pad)) return null;
  if (mencionaNoModelada(q)) return null;
  const v = d[r.dataKey];
  if (!v) {
    return `La vista de **${r.etiqueta}** todavía se está cargando. Puedes consultarla completa en ` +
      `[la página de ${r.nombre}](../${r.pagina}) o volver a preguntar en unos segundos.`;
  }
  const tipo = tipoEfectivo(q, ent);
  const etiqueta = `_${v.publication_label}._`;
  const pie = `\n\nGráfica interactiva por estado y sexo: [${r.nombre} · pronóstico semanal](../${r.pagina}).`;
  const sexo = ent.sexo || 'general';
  const sexoTxt = SEXO_TXT[sexo];
  const est = Object.values(v.series).filter((x) => x.nivel === 'estado' && x.sexo === sexo && x.oos.smape != null);
  const oosTxt = `${est[0]?.oos.semanas ?? 0} semanas observadas tras el origen ${semana(v.origin)}`;
  const fin = (lineas, estados) => lineas.join('\n') + pie + marca(tipo, ent, estados, r);
  const conOos = est.length > 0;
  const pideError = any(q, ['error', 'smape', 'precision', 'sesgo', 'desempeno']);

  if (tipo in NO_DISPONIBLE) {
    return `${noDisponible(tipo, r.nombre)}\n\nPara ${r.etiqueta} sí puedes pedir ${alternativas(r, conOos)}.` + pie + marca(tipo, ent, null, r);
  }

  if (!conOos && (['ranking', 'calibracion', 'volumen_error'].includes(tipo) || (tipo === 'mapa' && pideError))) {
    return fin([`**${r.etiqueta}: aún no hay desempeño que mostrar.**`, '', enCurso(v), '',
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
    const todos = Object.values(v.series).filter((x) => x.nivel === 'estado' && x.sexo === sexo);
    const orden = [...todos].sort((a, b) => b.pronostico_52_total - a.pronostico_52_total).slice(0, 5);
    const nac = v.series[`nacional|mx|${sexo}`];
    return fin([`**${r.etiqueta}: casos pronosticados por estado en ${v.horizon_weeks} semanas, ${sexoTxt}**`, '',
      `Total nacional: **${ent0(nac.pronostico_52_total)} casos**. Estados con más casos pronosticados:`,
      ...orden.map((x) => `- **${x.nombre}**: ${ent0(x.pronostico_52_total)} casos`), '', etiqueta, `_${v.uncertainty_label}._`]);
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
      `Se modelan **${v.models} series** (32 estados × hombres y mujeres); los otros ${v.products - v.models} de los ${v.products} productos (totales estatales, regionales y nacional) se obtienen sumándolas.`, '',
      ...cuenta.map(([m, n]) => `- ${OBESIDAD_MOTOR[m] || m}: **${n}** series`), '',
      'El motor de cada serie se eligió con validación cruzada temporal en pliegues de 2021 a 2024, en los que el modelo nunca ve el periodo que pronostica.',
      `Pregunta por un estado y un sexo («motor de ${r.consulta} en Jalisco mujeres») para ver el de esa serie.`, '', etiqueta]);
  }

  if (tipo === 'comparador') {
    let nombres = estadosEnConsulta(v, q);
    const top = nombres.length < 2;
    if (top) nombres = Object.values(v.series).filter((x) => x.nivel === 'estado' && x.sexo === 'general').sort((a, b) => b.pronostico_52_total - a.pronostico_52_total).slice(0, 5).map((x) => x.nombre);
    const filas = nombres.slice(0, 6).map((n) => Object.values(v.series).find((x) => x.nivel === 'estado' && x.sexo === sexo && x.nombre === n)).filter(Boolean);
    return fin([`**${r.etiqueta}: comparación de estados, ${sexoTxt}**${top ? ' (los cinco con más casos pronosticados; nombra dos o más estados para compararlos)' : ''}`, '',
      ...filas.map((x) => `- **${x.nombre}**: ${desempeno(x, v)}`),
      '', etiqueta], filas.map((x) => x.nombre));
  }

  const x = serieObesidad(v, ent);
  if (!x) return null;

  if (tipo === 'sexo') {
    const base = x.nivel === 'nacional' ? 'nacional|mx' : `estado|${x.id}`;
    const lugar = x.nivel === 'nacional' ? 'Nacional' : x.nombre;
    const fila = (sx) => { const y = v.series[`${base}|${sx}`]; return `- **${y.sexo_nombre}**: ${desempeno(y, v)} (${motorDe(v, y)})`; };
    return fin([`**${r.etiqueta} · ${lugar}: hombres y mujeres**${conOos ? ` (${oosTxt})` : ''}.`, '', fila('hombres'), fila('mujeres'), '', etiqueta]);
  }

  if (tipo === 'acumulado') {
    const total = (xs) => xs.reduce((a, [, y]) => a + Math.round(y * 10), 0) / 10;
    const vistas = x.pronostico.filter(([ds]) => ds <= v.observation_cutoff_ds);
    return fin([...ficha(v, x, 'acumulado', r), '',
      ...(x.oos.semanas ? [`Acumulado del pronóstico hasta ${semana(v.observation_cutoff)}: ${ent0(total(vistas))} casos; observado: ${ent0(x.oos.observado_total)}.`] : []),
      `Acumulado de las ${v.horizon_weeks} semanas: **${ent0(x.pronostico_52_total)} casos**.`, '', etiqueta]);
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
    lineas.push('', '**Siguientes semanas del pronóstico, aún sin observación publicada:**', ...futuras.map(([ds, y]) => `- Semana del ${ds}: ${ent0(y)} casos`));
  }
  lineas.push('', `Total pronosticado en las ${v.horizon_weeks} semanas: **${ent0(x.pronostico_52_total)} casos**.`, '', etiqueta, `_${v.uncertainty_label}._`);
  if (tipo === 'banda') lineas.push('', `${r.nombre} se publica **sin intervalos**: la gráfica muestra sólo el pronóstico puntual, no un corredor ni una banda de confianza.`);
  return fin(lineas);
}

