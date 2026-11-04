/**
 * obesidad_kb.js — C7.7: respuestas del EpiBot sobre Obesidad (E66), desde su vista publicada.
 *
 * Extraído de kb.js. El tipo de respuesta lo decide `tipoEfectivo` (obesidad_charts.js), el mismo
 * que usa la gráfica; la respuesta lleva un marcador `<!--OBESIDAD:{...}-->` con el tipo, la
 * geografía y el sexo resueltos, para que app.js dibuje exactamente lo que dice el texto también en
 * follow-ups («¿y hombres?») y en consultas corregidas por typo, donde la consulta cruda ya no
 * nombra a Obesidad.
 */
import { mencionaNoModelada } from './entities.js?v=32';
import {
  OBESIDAD_KW, MOTOR_NOMBRE as OBESIDAD_MOTOR, tipoEfectivo, NO_DISPONIBLE, ALTERNATIVAS,
  serieObesidad, estadosEnConsulta, emisionTxt,
} from './obesidad_charts.js?v=2';

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

function ficha(v, x, encabezado) {
  const lugar = x.nivel === 'nacional' ? 'Nacional' : x.nombre;
  return [
    `**Obesidad (E66) · ${lugar} · ${x.sexo_nombre}${encabezado ? ` · ${encabezado}` : ''}**`,
    '',
    `Pronóstico **congelado**: datos hasta ${semana(v.origin)}, ${emisionTxt(v)}, ${v.horizon_weeks} semanas, sin reentrenar; motor: ${motorDe(v, x)}.`,
    '',
    `**Cómo le ha ido fuera de muestra** (${x.oos.semanas} semanas observadas, hasta ${semana(v.observation_cutoff)}):`,
    `- sMAPE: **${num1(x.oos.smape)} %**`,
    `- Error medio absoluto: ${ent0(x.oos.mae)} casos por semana`,
    `- Sesgo: ${num1(x.oos.sesgo_pct)} % (observados ${ent0(x.oos.observado_total)} frente a ${ent0(x.oos.pronostico_total)} pronosticados)`,
  ];
}

/** Marcador para app.js: la gráfica sigue al texto aunque la consulta cruda no diga «obesidad». */
const marca = (tipo, ent, estados) => `\n<!--OBESIDAD:${JSON.stringify({ tipo, estado: ent.estado || null, sexo: ent.sexo || null, estados: estados || null })}-->`;

export function answerObesidad(q, ent, s, d) {
  // Obesidad la nombra la consulta o la trae el contexto (follow-up) o la corrección de typos.
  if (!any(q, OBESIDAD_KW) && ent.padecimiento !== 'Obesidad') return null;
  // Si la pregunta nombra además otro padecimiento, modelado o no, la responde su handler.
  if (ent.padecimiento && ent.padecimiento !== 'Obesidad') return null;
  if ((ent.padecimientos || []).some((p) => p !== 'Obesidad')) return null;
  if (mencionaNoModelada(q)) return null;
  const v = d.obesidad;
  if (!v) {
    return 'La vista de **Obesidad (E66)** todavía se está cargando. Puedes consultarla completa en ' +
      '[la página de Obesidad](../obesidad.html) o volver a preguntar en unos segundos.';
  }
  const tipo = tipoEfectivo(q, ent);
  const etiqueta = `_${v.publication_label}._`;
  const pie = `\n\nGráfica interactiva por estado y sexo: [Obesidad · pronóstico semanal](../obesidad.html).`;
  const sexo = ent.sexo || 'general';
  const sexoTxt = SEXO_TXT[sexo];
  const est = Object.values(v.series).filter((x) => x.nivel === 'estado' && x.sexo === sexo && x.oos.smape != null);
  const oosTxt = `${est[0]?.oos.semanas ?? 0} semanas observadas tras el origen ${semana(v.origin)}`;
  const fin = (lineas, estados) => lineas.join('\n') + pie + marca(tipo, ent, estados);

  if (tipo in NO_DISPONIBLE) {
    return `${NO_DISPONIBLE[tipo]}\n\nPara Obesidad (E66) sí puedes pedir ${ALTERNATIVAS}.` + pie + marca(tipo, ent);
  }

  if (tipo === 'ranking') {
    const orden = [...est].sort((a, b) => a.oos.smape - b.oos.smape);
    const linea = (x, i) => `${i + 1}. **${x.nombre}**: sMAPE ${num1(x.oos.smape)} % (sesgo ${num1(x.oos.sesgo_pct)} %)`;
    return fin([
      `**Obesidad (E66): desempeño fuera de muestra por estado, ${sexoTxt}** (${oosTxt}).`, '',
      '**Más precisos:**', ...orden.slice(0, 5).map(linea),
      '', '**Menos precisos:**', ...orden.slice(-5).reverse().map((x, i) => linea(x, orden.length - 1 - i)),
      '', etiqueta,
    ]);
  }

  if (tipo === 'mapa' || tipo === 'entidades') {
    if (tipo === 'mapa' && any(q, ['error', 'smape', 'precision', 'sesgo', 'desempeno'])) {
      const orden = [...est].sort((a, b) => b.oos.smape - a.oos.smape).slice(0, 5);
      return fin([`**Obesidad (E66): mapa del sMAPE fuera de muestra, ${sexoTxt}** (${oosTxt}).`, '',
        `Mediana estatal: **${num1(mediana(est.map((x) => x.oos.smape)))} %**. Estados con mayor error:`,
        ...orden.map((x) => `- **${x.nombre}**: ${num1(x.oos.smape)} %`), '', etiqueta]);
    }
    const todos = Object.values(v.series).filter((x) => x.nivel === 'estado' && x.sexo === sexo);
    const orden = [...todos].sort((a, b) => b.pronostico_52_total - a.pronostico_52_total).slice(0, 5);
    const nac = v.series[`nacional|mx|${sexo}`];
    return fin([`**Obesidad (E66): casos pronosticados por estado en ${v.horizon_weeks} semanas, ${sexoTxt}**`, '',
      `Total nacional: **${ent0(nac.pronostico_52_total)} casos**. Estados con más casos pronosticados:`,
      ...orden.map((x) => `- **${x.nombre}**: ${ent0(x.pronostico_52_total)} casos`), '', etiqueta, `_${v.uncertainty_label}._`]);
  }

  if (tipo === 'calibracion' || tipo === 'volumen_error') {
    const bajo = est.filter((x) => x.oos.sesgo_pct < 0).length;
    const nac = v.series[`nacional|mx|${sexo}`];
    const cal = tipo === 'calibracion';
    return fin([`**Obesidad (E66): ${cal ? 'calibración por estado' : 'volumen observado frente a error'}, ${sexoTxt}** (${oosTxt}).`, '',
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
    return fin([`**Obesidad (E66): motores del release** \`${v.release_id}\``, '',
      `Se modelan **${v.models} series** (32 estados × hombres y mujeres); los otros ${v.products - v.models} de los ${v.products} productos (totales estatales, regionales y nacional) se obtienen sumándolas.`, '',
      ...cuenta.map(([m, n]) => `- ${OBESIDAD_MOTOR[m] || m}: **${n}** series`), '',
      'El motor de cada serie se eligió con validación cruzada temporal en pliegues de 2021 a 2024, en los que el modelo nunca ve el periodo que pronostica.',
      'Pregunta por un estado y un sexo («motor de obesidad en Jalisco mujeres») para ver el de esa serie.', '', etiqueta]);
  }

  if (tipo === 'comparador') {
    let nombres = estadosEnConsulta(v, q);
    const top = nombres.length < 2;
    if (top) nombres = Object.values(v.series).filter((x) => x.nivel === 'estado' && x.sexo === 'general').sort((a, b) => b.pronostico_52_total - a.pronostico_52_total).slice(0, 5).map((x) => x.nombre);
    const filas = nombres.slice(0, 6).map((n) => Object.values(v.series).find((x) => x.nivel === 'estado' && x.sexo === sexo && x.nombre === n)).filter(Boolean);
    return fin([`**Obesidad (E66): comparación de estados, ${sexoTxt}**${top ? ' (los cinco con más casos pronosticados; nombra dos o más estados para compararlos)' : ''}`, '',
      ...filas.map((x) => `- **${x.nombre}**: sMAPE ${num1(x.oos.smape)} %, sesgo ${num1(x.oos.sesgo_pct)} %, ${ent0(x.pronostico_52_total)} casos en ${v.horizon_weeks} semanas`),
      '', etiqueta], filas.map((x) => x.nombre));
  }

  const x = serieObesidad(v, ent);
  if (!x) return null;

  if (tipo === 'sexo') {
    const base = x.nivel === 'nacional' ? 'nacional|mx' : `estado|${x.id}`;
    const lugar = x.nivel === 'nacional' ? 'Nacional' : x.nombre;
    const fila = (sx) => { const y = v.series[`${base}|${sx}`]; return `- **${y.sexo_nombre}**: sMAPE ${num1(y.oos.smape)} %, sesgo ${num1(y.oos.sesgo_pct)} %, ${ent0(y.pronostico_52_total)} casos en ${v.horizon_weeks} semanas (${motorDe(v, y)})`; };
    return fin([`**Obesidad (E66) · ${lugar}: hombres y mujeres** (${oosTxt}).`, '', fila('hombres'), fila('mujeres'), '', etiqueta]);
  }

  if (tipo === 'acumulado') {
    const total = (xs) => xs.reduce((a, [, y]) => a + Math.round(y * 10), 0) / 10;
    const vistas = x.pronostico.filter(([ds]) => ds <= v.observation_cutoff_ds);
    return fin([...ficha(v, x, 'acumulado'), '',
      `Acumulado del pronóstico hasta ${semana(v.observation_cutoff)}: ${ent0(total(vistas))} casos; observado: ${ent0(x.oos.observado_total)}.`,
      `Acumulado de las ${v.horizon_weeks} semanas: **${ent0(x.pronostico_52_total)} casos**.`, '', etiqueta]);
  }

  const encabezado = { seguimiento: 'zoom semanal', motor_serie: 'motor' }[tipo] || '';
  const lineas = ficha(v, x, encabezado);
  if (tipo === 'motor_serie') lineas.splice(2, 0, `El motor de esta serie es **${motorDe(v, x)}**.`, '');
  if (tipo === 'seguimiento') {
    const obs = new Map(x.observado);
    const ult = x.pronostico.filter(([ds]) => obs.has(ds)).slice(-4);
    lineas.push('', '**Últimas semanas observadas frente al pronóstico:**', ...ult.map(([ds, y]) => `- Semana del ${ds}: observado ${ent0(obs.get(ds))}, pronóstico ${ent0(y)}`));
  }
  const futuras = x.pronostico.filter(([ds]) => ds > v.observation_cutoff_ds).slice(0, 4);
  if (futuras.length) {
    lineas.push('', '**Próximas semanas del pronóstico:**', ...futuras.map(([ds, y]) => `- Semana del ${ds}: ${ent0(y)} casos`));
  }
  lineas.push('', `Total pronosticado en las ${v.horizon_weeks} semanas: **${ent0(x.pronostico_52_total)} casos**.`, '', etiqueta, `_${v.uncertainty_label}._`);
  if (tipo === 'banda') lineas.push('', 'Obesidad se publica **sin intervalos**: la gráfica muestra sólo el pronóstico puntual, no un corredor ni una banda de confianza.');
  return fin(lineas);
}

