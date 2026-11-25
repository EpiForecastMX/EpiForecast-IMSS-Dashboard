/**
 * compuesta.js — preguntas compuestas con la calculadora determinista (mesa agéntica, fase 1, 25-nov-2026).
 *
 * Huecos que la mesa encontró en el bot de reglas:
 * - «¿cuál sube más rápido?» se contestaba con «más casos esperados» (otra métrica).
 * - «explícame la gráfica» repetía la respuesta anterior.
 * - «¿en qué meses hay más casos?» devolvía los estados con más casos.
 * - «¿hay relación entre…?» y «suma … y …» no tenían una negativa razonada.
 * Toda cifra sale de las vistas publicadas (o de zoom_series.json para los cuatro originales) mediante `calculo/`; el texto
 * sale de plantillas. Ningún modelo de lenguaje interviene.
 *
 * Los manejadores reciben `ctx = { lastEntities, releaseDePad, releasesEnConsulta }` desde kb.js para no duplicar módulos.
 */
import { crecimiento, estacionalidad, rasgosGrafica, compararRitmo } from './calculo/operaciones.js?v=2';
import { serieDeVista, serieLegacy, esLegacy } from './calculo/series.js?v=1';
import { negativaRazonada, negativaRiesgo } from './calculo/legitimidad.js?v=2';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const LEGACY_NOMBRE = { Dengue: 'Dengue', Depresion: 'Depresión', Parkinson: 'Parkinson', Alzheimer: 'Alzheimer' };
const ent0 = (n) => Math.round(n).toLocaleString('es-MX');
const casos = (n) => `${ent0(n)} ${Math.round(n) === 1 ? 'caso' : 'casos'}`;
const pct = (d) => `${d >= 0 ? '+' : '−'}${Math.round(Math.abs(d) * 100)} %`;
function fechaLarga(ds) {
  const [a, m, d] = ds.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}
const lista = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`);

export const RAPIDEZ_BAJA = /\b(baja mas rapido|bajan mas rapido|descenso mas rapido|descenso mas fuerte|cae mas rapido|caen mas rapido|disminuye mas|disminuyen mas|mayor descenso|mayor caida|baja mas|bajan mas)\b/;
export const RAPIDEZ = /\b(mas rapido|mas rapida|mas rapidamente|crece mas|crecen mas|sube mas|suben mas|aumenta mas|aumentan mas|mayor crecimiento|mayor aumento|se acelera|acelera mas|mas acelerad\w*)\b/;
const MESES_Q = /\b((cual es )?el mes (con|de) mas|en que (meses|mes|epoca|temporada)|que meses|cuales (son los )?meses|meses (con|de) mas|en que temporada|temporada alta|epoca (del ano )?(con|de) mas|estacionalidad|patron estacional|cuando (hay|da|pega|sube|aumenta|se presenta) mas)\b/;
const EXPLICA = /\b(explica\w*|que significa\w*|como (leo|se lee|interpreto|entiendo|sigo|traduzco|resumo)|que (muestra|dice|quiere decir|significan|representa\w*|se puede decir)|no entiendo|que estoy viendo|es el dato de cada semana|lo acumulado|lo que se lleva acumulado)\b.*\b(grafica|graficas|grafico|graficos|curva|curvas|linea|lineas|chart|numeros de abajo|eje|ejes)\b|\b(grafica|grafico|curva|linea)\b.*\b(explica\w*|que significa\w*|no entiendo|como se lee|que se puede decir|como (la |lo )?(traduzco|sigo|leo|resumo)|que estoy viendo|cada semana o|acumulado)\b|\bme explicas que estoy viendo\b|\blo que sube y baja\b/;

/** Padecimiento, lugar y sexo de la consulta o, si no nombra padecimiento, del contexto. */
function foco(ent, ctx, { heredaLugar = true } = {}) {
  const lastE = ctx.lastEntities || {};
  const pad = ent.padecimiento || lastE.padecimiento;
  if (!pad) return null;
  const nuevo = !!ent.padecimiento && ent.padecimiento !== lastE.padecimiento;
  return {
    pad,
    estado: ent.estado || (heredaLugar && !nuevo ? lastE.estado : null) || null,
    sexo: ent.sexo && ent.sexo !== 'general' ? ent.sexo : (!nuevo && lastE.sexo && lastE.sexo !== 'general' ? lastE.sexo : 'general'),
  };
}

/** Serie normalizada y nombre visible; null si el padecimiento es sensible o no hay datos cargados. */
function serieDe(f, d, ctx) {
  if (esLegacy(f.pad)) {
    const s = serieLegacy(d?.zoom_series, f.pad, f);
    return s ? { s, nombre: LEGACY_NOMBRE[f.pad] } : null;
  }
  const r = ctx.releaseDePad?.(f.pad);
  if (!r || r.sensible) return null;
  const v = d?.[r.dataKey];
  const s = v ? serieDeVista(v, f) : null;
  return s ? { s, nombre: r.nombre, r } : null;
}
const titulo = (nombre, s) => `${nombre} en ${s.lugar}${s.sexo !== 'general' ? ` (${s.sexo})` : ''}`;

/** «¿Hay relación entre varicela y parotiditis?», «suma dengue y varicela»: negativa con su motivo. */
export function answerNegativaRazonada(q, ent, s, d, ctx) {
  const rels = (ctx.releasesEnConsulta?.(q, { prefijos: true }) || []);
  if (rels.some((r) => r.sensible)) return null;
  const pads = [ent.padecimiento, ...(ent.padecimientos || [])].filter(Boolean);
  const legacy = pads.filter((p) => LEGACY_NOMBRE[p]).map((p) => LEGACY_NOMBRE[p]);
  const deEnt = pads.map((p) => ctx.releaseDePad?.(p)).filter((r) => r && !r.sensible);
  if (pads.some((p) => ctx.releaseDePad?.(p)?.sensible)) return null;
  const nombres = [...new Set([...legacy, ...rels.map((r) => r.nombreCorto || r.nombre), ...deEnt.map((r) => r.nombreCorto || r.nombre)])];
  // Sin padecimiento nuevo en el turno: «¿puedo decir que allá tengo el doble de riesgo?».
  if (!pads.length && !rels.length) {
    const r = negativaRiesgo(q);
    return r ? `${r}\n<!--SIN_GRAFICA-->` : null;
  }
  const n = negativaRazonada(q, nombres);
  return n ? `${n.texto}\n<!--SIN_GRAFICA-->` : null;
}

/** «¿En qué meses hay más casos de varicela?»: promedio semanal por mes con los años completos observados. */
export function answerEstacionalidad(q, ent, s, d, ctx) {
  if (!MESES_Q.test(q) || (ent.padecimientos || []).length > 1) return null;
  const f = foco(ent, ctx);
  const x = f && serieDe(f, d, ctx);
  if (!x) return null;
  const e = estacionalidad(x.s);
  const encabezado = `**${titulo(x.nombre, x.s)}: meses con más casos**`;
  if (!e) {
    return [encabezado, '', 'No tengo al menos dos años completos de datos semanales de esta serie, así que no puedo calcular en qué meses hay más casos.' +
      (f.pad === 'Dengue' ? ' Pregunta «histórico de dengue» para ver los años anteriores.' : ''), '<!--SIN_GRAFICA-->'].join('\n');
  }
  const periodo = `${e.anios[0]} a ${e.anios.at(-1)}`;
  if (e.pocos) {
    return [encabezado, '', `Hay muy pocos casos (unos ${ent0(e.media)} por semana en promedio de ${periodo}) para hablar de una temporada: ` +
      'con números tan pequeños, un mes «alto» puede ser casualidad.', '<!--SIN_GRAFICA-->'].join('\n');
  }
  const top = e.orden.slice(0, 3), bajos = e.orden.slice(-2).reverse();
  const plano = e.orden[0][1] < 1.25 * e.media;
  return [encabezado, '',
    plano
      ? `No hay una temporada marcada: los casos se reparten de forma pareja en el año (el mes más alto, ${MESES[top[0][0]]}, apenas supera el promedio).`
      : `Los meses con más casos son **${lista(top.map(([m]) => MESES[m]))}** (en promedio, unos ${lista(top.map(([, v]) => ent0(v)))} casos por semana); ` +
        `los de menos, **${lista(bajos.map(([m]) => MESES[m]))}** (unos ${lista(bajos.map(([, v]) => ent0(v)))}).`,
    '',
    `- Promedio de casos notificados por semana en cada mes, de ${periodo}: ${e.promedio.map((v, i) => `${MESES[i]} ${ent0(v)}`).join(' · ')}.`,
    '',
    `_Promedio de ${e.anios.length} años completos observados; casos notificados, sin ajustar por población. Un año atípico puede mover el promedio._`,
    '<!--SIN_GRAFICA-->'].join('\n');
}

/** «Explícame la gráfica»: cómo leer la gráfica del padecimiento en contexto, con sus rasgos calculados. */
export function answerExplicaGrafica(q, ent, s, d, ctx) {
  if (!EXPLICA.test(q)) return null;
  const f = foco(ent, ctx);
  const x = f && serieDe(f, d, ctx);
  if (!x) return null;
  const g = rasgosGrafica(x.s);
  if (!g) return null;
  const c = crecimiento(x.s);
  const metodo = x.s.tipo === 'control'
    ? 'No es un modelo validado: repite lo ocurrido en las mismas semanas del año anterior.'
    : x.s.tipo === 'modelo' ? 'Lo calcula el modelo elegido por su desempeño con datos que no vio.' : 'Lo calcula el motor elegido para esta serie.';
  const ahora = !c ? null : c.afirmable
    ? `se espera que ${c.delta > 0 ? 'suba' : 'baje'}: unos ${casos(c.F4)} en las próximas 4 semanas, frente a ${ent0(c.O4)} en las 4 anteriores (${pct(c.delta)}).`
    : `no se espera un cambio claro: unos ${casos(c.F4)} en las próximas 4 semanas, frente a ${ent0(c.O4)} en las 4 anteriores${c.basePequena ? ' (son muy pocos casos para hablar de tendencia)' : ''}.`;
  return [`**Cómo leer la gráfica de ${titulo(x.nombre, x.s)}**`, '',
    '- **Qué mide:** casos notificados por semana al boletín epidemiológico (no todos los enfermos se diagnostican ni se reportan), sin ajustar por población.',
    `- **Lo observado** llega hasta la semana del ${fechaLarga(g.ultimoObs)}; las últimas semanas pueden corregirse cuando llegan notificaciones tardías.`,
    g.primeroPron ? `- **El pronóstico** cubre ${g.semanasPron} semanas, de la semana del ${fechaLarga(g.primeroPron)} a la del ${fechaLarga(g.ultimoPron)}. ${metodo}` : null,
    g.maxReciente ? `- **Lo más alto del último año:** ${casos(g.maxReciente[1])}, la semana del ${fechaLarga(g.maxReciente[0])}.` : null,
    g.picoPron ? `- **Pico del pronóstico:** unos ${casos(g.picoPron[1])}, la semana del ${fechaLarga(g.picoPron[0])}.` : null,
    ahora ? `- **Ahora:** ${ahora}` : null,
    '- **Lo que no muestra:** un rango de error (cada semana es una cifra única), tasas por población ni las causas de los cambios.',
    '<!--SIN_GRAFICA-->'].filter((l) => l != null).join('\n');
}

/**
 * Línea de veredicto para «¿dónde sube más rápido?» en una comparación. `filas` = [{ nombre, serie }] con series de
 * `calculo/series.js`. Devuelve markdown o null si no hay al menos dos series con pronóstico.
 */
export function lineaRitmo(filas, direccion = 'sube') {
  const r = compararRitmo(filas, direccion);
  if (r.veredicto === 'sin_datos') return null;
  if (r.veredicto === 'pocos_casos') return `**Cuál ${direccion === 'baja' ? 'baja' : 'sube'} más rápido:** no lo puedo decir: hay muy pocos casos para comparar porcentajes.`;
  const fuera = r.excluidas ? ` (${r.excluidas === 1 ? 'una serie con muy pocos casos queda' : `${r.excluidas} series con muy pocos casos quedan`} fuera)` : '';
  const [a, b] = r.orden;
  let linea;
  if (r.veredicto === 'nadie_baja') linea = `**Ninguno baja:** en las próximas 4 semanas se espera que ${lista(r.orden.map((f) => f.nombre))} se mantengan o suban${fuera}.`;
  else if (r.veredicto === 'baja') linea = `**Baja más rápido:** ${a.nombre}, de ${ent0(a.c.O4)} a unos ${casos(a.c.F4)} (${pct(a.c.delta)}) en las próximas 4 semanas frente a las 4 anteriores; ${b.nombre}, ${pct(b.c.delta)}${fuera}.`;
  else if (r.veredicto === 'nadie_sube') linea = `**Ninguno sube:** en las próximas 4 semanas se espera que ${lista(r.orden.map((f) => f.nombre))} se mantengan o bajen${fuera}.`;
  else if (r.veredicto === 'ruido') linea = `**Sin diferencia clara:** el mayor aumento (${a.nombre}, ${pct(a.c.delta)}) está dentro de la variación normal de los conteos${fuera}.`;
  else linea = `**Sube más rápido:** ${a.nombre}, de ${ent0(a.c.O4)} a unos ${casos(a.c.F4)} (${pct(a.c.delta)}) en las próximas 4 semanas frente a las 4 anteriores; ${b.nombre}, ${pct(b.c.delta)}${fuera}.`;
  if (r.mezclaControl) linea += ' _Ojo: no todos tienen un modelo validado (los controles repiten el año pasado), así que la comparación es orientativa._';
  if (r.todosControl && (r.veredicto === 'sube' || r.veredicto === 'baja')) linea += ' _Son controles estacionales: el cambio que se espera es el que hubo en estas semanas el año pasado._';
  if (r.cortesDistintos) linea += ' _Los datos no llegan a la misma semana en todos._';
  return linea;
}
