/**
 * resumen_llano.js — respuesta en lenguaje llano para los padecimientos del runner (rediseño conversacional,
 * 24-nov-2026, mesa redonda: diseño conversacional + epidemiología).
 *
 * Primero la respuesta directa (sube, baja o se mantiene), luego lo observado frente al año anterior, lo esperado, dónde
 * hay más casos y la confiabilidad en tres niveles. Todo sale de la vista publicada (`publication/<id>/vista.json`):
 * ninguna cifra se inventa, no se añaden intervalos y un control estacional nunca se presenta como validado.
 *
 * Reglas (epidemiología):
 * - O4 = casos de las últimas 4 semanas observadas; F4 = pronóstico de las 4 semanas siguientes a la última observada.
 * - Δ = F4 / O4 − 1. Sube si Δ ≥ +10 % y |F4 − O4| ≥ 2·√O4 (filtra el ruido de pocos casos); baja en el caso simétrico;
 *   si no, estable.
 * - Freno de credibilidad: con 2 o más semanas comprobadas, si el sesgo fuera de muestra tiene el signo de Δ y es al menos
 *   tan grande, no se afirma la tendencia.
 * - Confiabilidad: alta (validación prospectiva PASS), media (aceptado en su prueba, comprobación en curso), baja (control
 *   estacional, FAIL o sesgo comprobado mayor de 20 % en la serie consultada).
 */

import { preguntaPorBrote } from './calculo/legitimidad.js?v=2';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const ent0 = (n) => (n == null ? '—' : Math.round(n).toLocaleString('es-MX'));
const pct0 = (n) => `${Math.round(Math.abs(n))} %`;
const suma = (xs) => xs.reduce((a, [, y]) => a + (Number(y) || 0), 0);
const DIA = 864e5;
const isoMenos = (ds, dias) => new Date(Date.parse(`${ds}T00:00:00Z`) - dias * DIA).toISOString().slice(0, 10);
/** «México» en las series es el Estado de México. */
export const nombreEstado = (n) => (n === 'México' ? 'Estado de México' : n);
const casos = (n) => `${ent0(n)} ${Math.round(n) === 1 ? 'caso' : 'casos'}`;
/** «2 de febrero de 2027» desde una fecha ISO (UTC, sin desfase de zona). */
export function fechaLarga(ds) {
  const [a, m, d] = ds.split('-').map(Number);
  return `${d} de ${MESES[m - 1]} de ${a}`;
}
const norm = (q) => String(q || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Indicadores de una serie de la vista. */
export function indicadores(v, x) {
  const obs = x.observado || [];
  if (!obs.length) return null;
  const ultimo = obs.at(-1)[0];
  const mapa = new Map(obs);
  const ult4 = obs.slice(-4);
  const O4 = suma(ult4);
  const previas = ult4.map(([ds]) => mapa.get(isoMenos(ds, 364)));
  const O4py = previas.every((y) => y != null) ? previas.reduce((a, y) => a + y, 0) : null;
  const fut = (x.pronostico || []).filter(([ds]) => ds > ultimo);
  const F4 = fut.length >= 4 ? suma(fut.slice(0, 4)) : null;
  const anio = ultimo.slice(0, 4);
  const ytd = suma(obs.filter(([ds]) => ds.startsWith(anio)));
  const inicioPrevio = `${Number(anio) - 1}-01-01`;
  const finPrevio = isoMenos(ultimo, 364);
  const enRangoPrevio = obs.filter(([ds]) => ds >= inicioPrevio && ds <= finPrevio);
  const ytdPrevio = obs[0][0] <= `${Number(anio) - 1}-01-07` ? suma(enRangoPrevio) : null;
  let tendencia = 'estable';
  let delta = null;
  if (F4 != null) {
    if (O4 > 0) {
      delta = F4 / O4 - 1;
      const ruido = Math.abs(F4 - O4) >= 2 * Math.sqrt(O4);
      if (delta >= 0.10 && ruido) tendencia = 'sube';
      else if (delta <= -0.10 && ruido) tendencia = 'baja';
    } else if (F4 >= 5) {
      tendencia = 'sube';
    }
    const s = x.oos?.semanas >= 2 ? x.oos.sesgo_pct : null;
    if (tendencia !== 'estable' && s != null && delta != null && Math.sign(s) === Math.sign(delta) && Math.abs(s) >= Math.abs(delta * 100)) {
      tendencia = 'incierto';
    }
  }
  // Notificación atípica: las últimas 4 semanas muy por debajo de las 8 previas y del año anterior (retraso, semana sin
  // boletín o cambio en la notificación). Entonces no se afirma una tendencia: el «aumento» sería el regreso a lo habitual.
  const previas8 = obs.slice(-12, -4);
  const habitual = previas8.length === 8 ? suma(previas8) / 2 : null;
  const atipico = habitual != null && habitual >= 20 && O4 < 0.6 * habitual && (O4py == null || O4 < 0.6 * O4py);
  if (atipico && F4 != null) tendencia = 'atipico';
  // Muy pocos casos: con menos de 10 en ambas ventanas un cambio porcentual engaña («de 1 a 3 es +200 %»).
  if (F4 != null && Math.max(O4, F4) < 10) tendencia = 'pocos';
  const pico = fut.length ? fut.reduce((a, b) => (b[1] > a[1] ? b : a)) : null;
  const promedioFut = fut.length ? suma(fut) / fut.length : 0;
  return { ultimo, O4, O4py, F4, ytd, ytdPrevio, anio, tendencia, delta, fut, pico, promedioFut, mapa, habitual };
}

/** Confiabilidad en tres niveles, con su explicación en lenguaje llano. */
export function confiabilidad(v, x, esControl) {
  const o = x.oos || {};
  const comprobado = o.semanas
    ? ` En ${o.semanas === 1 ? 'la semana ya comprobada' : `las ${o.semanas} semanas ya comprobadas`} esperaba ${casos(o.pronostico_total)} y llegaron ${ent0(o.observado_total)}` +
      (o.observado_total < 10 && o.pronostico_total < 10 ? '.'
        : Math.abs(o.sesgo_pct) >= 1 ? ` (${o.sesgo_pct > 0 ? 'se pasó' : 'se quedó corto'} ${pct0(o.sesgo_pct)}).` : ', prácticamente lo mismo.')
    : '';
  const sinRango = /sin interval/i.test(v.uncertainty_label || '') ? ' Es una cifra única, sin rango de error.' : '';
  if (esControl) {
    return {
      nivel: 'baja',
      texto: `**Confiabilidad: baja.** No es un modelo validado: repite lo ocurrido en las mismas semanas del año anterior, porque el modelo probado no lo mejoró en su prueba de aceptación.${comprobado}${sinRango}`,
    };
  }
  if (v.verdict === 'FAIL') {
    return { nivel: 'baja', texto: `**Confiabilidad: baja.** No superó la comprobación con datos reales posteriores a su emisión.${comprobado}${sinRango}` };
  }
  if (o.semanas >= 2 && Math.abs(o.sesgo_pct) > 20 && Math.max(o.observado_total, o.pronostico_total) >= 10) {
    return {
      nivel: 'baja',
      texto: `**Confiabilidad: baja aquí.** El modelo superó su prueba de aceptación, pero en esta serie se ha desviado.${comprobado}${sinRango}`,
    };
  }
  if (v.verdict === 'PASS') {
    return { nivel: 'alta', texto: `**Confiabilidad: alta.** Superó su prueba de aceptación y acertó en las ${v.weeks_required} semanas reales que siguieron a su emisión.${comprobado}${sinRango}` };
  }
  return {
    nivel: 'media',
    texto: `**Confiabilidad: media.** Superó su prueba de aceptación con datos que no vio; la comprobación con datos reales va en ${v.weeks_available} de ${v.weeks_required} semanas.${comprobado}${sinRango}`,
  };
}

/** Periodo pedido en la consulta: semana pasada, un mes, un año o el año en curso. */
function periodoPedido(q) {
  const n = ` ${norm(q).replace(/[^a-z0-9]+/g, ' ')} `;
  if (/ (mucho o poco|es mucho|es poco|esta peor|esta mejor|el ano pasado|ano anterior|comparado con el ano|misma ventana) /.test(n)) return { tipo: 'vsanio' };
  if (/ (pico|temporada alta|cuando (sube|aumenta|hay) mas|cuando es la temporada|en que mes|estacionalidad|estacional|temporada) /.test(n)) return { tipo: 'pico' };
  if (/ (semana pasada|ultima semana|esta semana|semana anterior) /.test(n)) return { tipo: 'semana' };
  if (/ (proximo mes|siguiente mes|el mes que viene|proximas semanas|proximas 4 semanas) /.test(n)) return { tipo: 'proximo' };
  // Mesa de la plataforma (25-nov-2026, Codex Sol): «semana 44 de 2026» encabezaba con el total del año y «en 52 semanas» con
  // las próximas 4. Ahora se contesta primero el periodo pedido.
  const sem = n.match(/ semana (?:epidemiologica )?(\d{1,2})(?: (?:de|del) (?:ano )?(20\d\d))? /);
  if (sem && Number(sem[1]) >= 1 && Number(sem[1]) <= 53) return { tipo: 'semana_n', semana: Number(sem[1]), anio: sem[2] ? Number(sem[2]) : null };
  if (/ (52 semanas|proximos 12 meses|proximo ano|siguiente ano|todo el horizonte) /.test(n)) return { tipo: 'horizonte' };
  if (/ (este ano|en lo que va del ano|en lo que va de) /.test(n)) return { tipo: 'anio_actual' };
  const anio = n.match(/ (202[3-7]) /);
  const mes = MESES.findIndex((m) => n.includes(` ${m} `));
  if (mes >= 0) return { tipo: 'mes', mes, anio: anio ? Number(anio[1]) : null };
  if (anio) return Number(anio[1]) === new Date().getUTCFullYear() ? { tipo: 'anio_actual' } : { tipo: 'anio', anio: Number(anio[1]) };
  return null;
}

function respuestaPeriodo(p, ind, x, lugar0) {
  if (!p) return null;
  const lugar = `${lugar0}${x?.sexo && x.sexo !== 'general' ? ` (${x.sexo})` : ''}`;
  if (p.tipo === 'vsanio') {
    if (!ind.O4py) return null;
    const d = ind.O4 / ind.O4py - 1;
    const como = Math.abs(d) < 0.1 ? 'una cifra parecida a la de' : d > 0 ? `${pct0(d * 100)} más que en` : `${pct0(d * 100)} menos que en`;
    return `**Frente al año pasado:** en las últimas 4 semanas hubo ${casos(ind.O4)}${lugar}, ${como} las mismas semanas de ${Number(ind.anio) - 1} (${ent0(ind.O4py)}).`;
  }
  if (p.tipo === 'pico') {
    if (!ind.pico) return null;
    if (ind.pico[1] < 0.5) return `**No se espera un pico:** el pronóstico no anticipa casos${lugar} en los próximos 12 meses.`;
    return `**El pico esperado en los próximos 12 meses** es la semana del ${fechaLarga(ind.pico[0])}, con unos **${casos(ind.pico[1])}**${lugar}.`;
  }
  if (p.tipo === 'semana') {
    const [ds, y] = x.observado.at(-1);
    return `**En la última semana con datos** (la del ${fechaLarga(ds)}) se notificaron **${casos(y)}**${lugar}.`;
  }
  if (p.tipo === 'semana_n') {
    // Semana epidemiológica de domingo a sábado (regla del 4 de enero); las fechas de la serie caen dentro de ella.
    const a = p.anio ?? Number(ind.anio);
    const j4 = Date.UTC(a, 0, 4), ini = j4 - new Date(j4).getUTCDay() * DIA + (p.semana - 1) * 7 * DIA;
    const d0 = new Date(ini).toISOString().slice(0, 10), d6 = new Date(ini + 6 * DIA).toISOString().slice(0, 10);
    const enSemana = ([ds]) => ds >= d0 && ds <= d6;
    const mismoMes = d0.slice(0, 7) === d6.slice(0, 7);
    const rango = mismoMes ? `del ${Number(d0.slice(8))} al ${fechaLarga(d6)}` : `del ${fechaLarga(d0).replace(/ de \d{4}$/, '')} al ${fechaLarga(d6)}`;
    const o = (x.observado || []).find(enSemana);
    if (o && o[1] != null) return `**En la semana ${p.semana} de ${a}** (${rango}) se notificaron **${casos(o[1])}**${lugar}.`;
    const f = (x.pronostico || []).find(enSemana);
    const ultimo = x.observado.at(-1)[0];
    if (f && f[0] > ultimo) return `**La semana ${p.semana} de ${a}** (${rango}) **aún no tiene dato** en el boletín: la última con datos es la del ${fechaLarga(ultimo)}. Para esa semana se esperan unos **${casos(f[1])}**${lugar}.`;
    return null;
  }
  if (p.tipo === 'horizonte') {
    const pr = x.pronostico || [];
    if (!pr.length) return null;
    const total = Number.isFinite(x.pronostico_52_total) ? x.pronostico_52_total : suma(pr);
    return `**En las ${pr.length} semanas del pronóstico** (de la semana del ${fechaLarga(pr[0][0])} a la del ${fechaLarga(pr.at(-1)[0])}) se esperan unos **${casos(total)}**${lugar}.`;
  }
  // «El próximo mes» lo responde la línea de tendencia, que ya da las próximas 4 semanas.
  // Mesa de la plataforma (Codex Sol): es la suma de las semanas de la serie publicada, no el acumulado impreso del boletín
  // (que el radar muestra y puede diferir por correcciones); se dice cuál es.
  if (p.tipo === 'anio_actual') return `**En lo que va de ${ind.anio}** se han notificado **${casos(ind.ytd)}**${lugar} (suma de las semanas de la serie publicada; el acumulado que imprime el boletín puede diferir un poco por correcciones).`;
  if (p.tipo === 'anio') {
    const obs = x.observado.filter(([ds]) => ds.startsWith(String(p.anio)));
    const fut = ind.fut.filter(([ds]) => ds.startsWith(String(p.anio)));
    if (p.anio < Number(ind.anio) && obs.length) return `**En ${p.anio}** se notificaron **${casos(suma(obs))}**${lugar}.`;
    if (p.anio > Number(ind.anio) && fut.length) return `**En ${p.anio}** el pronóstico cubre ${fut.length} semanas, con unos **${casos(suma(fut))}**${lugar}.`;
    return null;
  }
  if (p.tipo === 'mes') {
    const clave = (ds) => Number(ds.slice(5, 7)) - 1 === p.mes && (!p.anio || ds.startsWith(String(p.anio)));
    const fut = ind.fut.filter(([ds]) => clave(ds));
    if (fut.length) {
      const a = fut[0][0].slice(0, 4);
      return `**En ${MESES[p.mes]} de ${a}** se esperan unos **${casos(suma(fut))}**${lugar} (${fut.length} semanas de pronóstico).`;
    }
    const obs = x.observado.filter(([ds]) => clave(ds)).filter(([ds]) => ds.startsWith(p.anio ? String(p.anio) : ind.anio));
    if (obs.length) return `**En ${MESES[p.mes]} de ${obs[0][0].slice(0, 4)}** se notificaron **${casos(suma(obs))}**${lugar}.`;
  }
  return null;
}

/** ¿La consulta pregunta si sube o si baja? Devuelve 'sube', 'baja' o null. */
function preguntaDireccion(q) {
  const n = ` ${norm(q).replace(/baja california( sur)?/g, ' ').replace(/[^a-z0-9]+/g, ' ')} `;
  // «brote» ya no cuenta como «¿sube?»: «¿hay un brote?» no se contesta «Sí» con una tendencia (mesa agéntica, 25-nov-2026).
  if (/ (sube|subiendo|subira|va a subir|aumenta|aumentando|aumentara|va a aumentar|crece|creciendo|al alza|empeora|empeorando|repunta|repunte) /.test(n)) return 'sube';
  if (/ (baja|bajando|bajara|va a bajar|disminuye|disminuyendo|disminuira|a la baja|mejora|mejorando|cae|cayendo) /.test(n)) return 'baja';
  return null;
}

/**
 * Líneas de la respuesta llana (markdown). `r` es el release, `x` la serie consultada, `estados` las series estatales del
 * mismo sexo para ubicar el lugar del estado o los estados con más casos.
 */
export function respuestaLlana({ v, x, r, q, esControl, estados, sinSexo, confianzaTexto }) {
  const ind = indicadores(v, x);
  if (!ind) return null;
  const nombre = r.nombre;
  const lugar = x.nivel === 'nacional' ? ' en el país' : x.nivel === 'estado' ? ` en ${nombreEstado(x.nombre)}` : ` en la región ${x.nombre}`;
  const sexoTxt = x.sexo === 'hombres' ? ' (hombres)' : x.sexo === 'mujeres' ? ' (mujeres)' : '';
  const sujeto = `${nombre}${lugar}${sexoTxt}`;
  const lineas = [];
  const pidio = preguntaDireccion(q);
  const d = ind.delta;
  // Un control estacional repite el año anterior: la tendencia se dice en condicional y, si este año va claramente por
  // debajo o por encima del anterior, se advierte que la cifra puede estar sobrestimada o subestimada.
  const c = esControl;
  const vsAnio = ind.O4py ? ind.O4 / ind.O4py - 1 : null;
  const sesgoControl = c && vsAnio != null && Math.abs(vsAnio) >= 0.2
    ? ` Este año va ${vsAnio < 0 ? 'por debajo' : 'por encima'} del anterior, así que esa cifra podría estar ${vsAnio < 0 ? 'sobrestimada' : 'subestimada'}.`
    : '';
  const si = c ? 'si se repite lo del año pasado, ' : '';
  const frase = {
    // Con menos de 10 casos de base, un porcentaje («445 % más») exagera: se dan las dos cifras.
    sube: ind.O4 < 10 ? `${si}se espera que **aumente**: unos ${casos(ind.F4)} en las próximas 4 semanas, frente a sólo ${ent0(ind.O4)} en las 4 anteriores.` : `${si}se espera que **aumente**: unos ${casos(ind.F4)} en las próximas 4 semanas, ${pct0((d ?? 0) * 100)} más que en las 4 anteriores (${ent0(ind.O4)}).`,
    baja: `${si}se espera que **disminuya**: unos ${casos(ind.F4)} en las próximas 4 semanas, ${pct0((d ?? 0) * 100)} menos que en las 4 anteriores (${ent0(ind.O4)}).`,
    estable: `${si}se espera que **se mantenga estable**: unos ${casos(ind.F4)} en las próximas 4 semanas, frente a ${ent0(ind.O4)} en las 4 anteriores.`,
    pocos: `hay **muy pocos casos**: ${casos(ind.O4)} en las últimas 4 semanas y ${Math.round(ind.F4) === 0 ? 'ninguno esperado' : `unos ${casos(ind.F4)} esperados`} en las próximas 4; con números tan pequeños no se puede hablar de una tendencia.`,
    atipico: `las últimas 4 semanas vienen **muy por debajo de lo habitual** (${ent0(ind.O4)} casos frente a unos ${ent0(ind.habitual)} en las 4 semanas típicas previas); puede deberse a un retraso o a un cambio en la notificación, así que no afirmo una tendencia. El pronóstico espera unos ${casos(ind.F4)} en las próximas 4 semanas, más cerca de lo habitual.`,
    incierto: `no hay una señal clara de cambio: el pronóstico espera unos ${casos(ind.F4)} en las próximas 4 semanas (${d >= 0 ? '+' : '−'}${pct0((d ?? 0) * 100)} frente a las 4 anteriores), pero en las semanas ya comprobadas se ha ${x.oos.sesgo_pct > 0 ? 'pasado' : 'quedado corto'} por ${pct0(x.oos.sesgo_pct)}, una diferencia de ese mismo tamaño.`,
  }[ind.tendencia];
  let sino = '';
  if (pidio && !preguntaPorBrote(norm(q)) && !/^\W*por ?que\b/.test(norm(q)) && !['incierto', 'atipico', 'pocos'].includes(ind.tendencia)) sino = ind.tendencia === pidio ? 'Sí. ' : 'No. ';
  if (x.nivel === 'nacional' && /\bmi (estado|ciudad|municipio|entidad|region|zona)\b/.test(norm(q))) {
    lineas.push('No sé en qué estado estás: dime cuál (por ejemplo, «en Jalisco») y te digo cómo va ahí. Mientras, así va en todo el país:', '');
  }
  if (/\b(tasa|por 100 ?mil|por cien mil|incidencia por|per capita)\b/.test(norm(q))) {
    lineas.push('_No calculo tasas por 100 mil habitantes: el boletín reporta casos notificados y aquí comparo casos._', '');
  }
  const periodo = respuestaPeriodo(periodoPedido(q), ind, x, lugar);
  // Con un periodo pedido, la respuesta empieza por el padecimiento para que no quede sin nombrar (batería ciega S).
  if (periodo) lineas.push(`**${sujeto}**`, '', periodo, '');
  if (ind.F4 != null) lineas.push(`${sino}${periodo ? 'En cuanto a la tendencia, ' : `**${sujeto}:** `}${frase}${['sube', 'baja', 'estable'].includes(ind.tendencia) ? sesgoControl : ''}`);
  lineas.push('');
  const semanaTxt = v.observation_cutoff && v.observation_cutoff[1] >= 4
    ? `semanas ${v.observation_cutoff[1] - 3} a ${v.observation_cutoff[1]} de ${v.observation_cutoff[0]}`
    : `últimas 4 semanas con datos (hasta la del ${fechaLarga(ind.ultimo)})`;
  const vsPrevio = ind.O4py != null && ind.O4py > 0
    ? (Math.abs(ind.O4 / ind.O4py - 1) < 0.005 ? `, igual que en las mismas semanas de ${Number(ind.anio) - 1}`
      : `, ${ind.O4 >= ind.O4py ? `${pct0((ind.O4 / ind.O4py - 1) * 100)} más` : `${pct0((1 - ind.O4 / ind.O4py) * 100)} menos`} que en las mismas semanas de ${Number(ind.anio) - 1} (${ent0(ind.O4py)})`)
    : '';
  lineas.push(`- **Ahora:** ${casos(ind.O4)} en las ${semanaTxt}${vsPrevio}.`);
  const vsYtd = ind.ytdPrevio ? `, ${ind.ytd >= ind.ytdPrevio ? `${pct0((ind.ytd / ind.ytdPrevio - 1) * 100)} más` : `${pct0((1 - ind.ytd / ind.ytdPrevio) * 100)} menos`} que a la misma fecha de ${Number(ind.anio) - 1}` : '';
  lineas.push(`- **En lo que va de ${ind.anio}:** ${casos(ind.ytd)}${vsYtd} (suma de las semanas de la serie).`);
  if (ind.pico && ind.promedioFut > 0 && ind.pico[1] >= 1.25 * ind.promedioFut && ind.pico[1] >= 10 && ind.pico[0] > isoMenos(ind.fut[Math.min(4, ind.fut.length - 1)][0], 0)) {
    lineas.push(`- **Pico esperado en los próximos 12 meses:** la semana del ${fechaLarga(ind.pico[0])}, con unos ${casos(ind.pico[1])}.`);
  }
  if (estados && estados.length) {
    const conF4 = estados.map((e) => ({ e, f: suma((e.pronostico || []).filter(([ds]) => ds > ind.ultimo).slice(0, 4)) }))
      .sort((a, b) => b.f - a.f);
    if (x.nivel === 'estado') {
      const i = conF4.findIndex((y) => y.e.id === x.id);
      if (i >= 0 && conF4[0].f > 0) lineas.push(`- **Lugar en el país:** ${i + 1}.º de ${conF4.length} estados por casos esperados (sin ajustar por población).`);
    } else if (x.nivel === 'nacional') {
      const top = conF4.filter((y) => y.f > 0).slice(0, 3);
      if (top.length) lineas.push(`- **Dónde hay más:** ${top.map((y) => `${nombreEstado(y.e.nombre)} (${ent0(y.f)})`).join(', ')}; casos esperados en 4 semanas, sin ajustar por población.`);
    }
  }
  lineas.push('', confianzaTexto || confiabilidad(v, x, esControl).texto, '',
    '_Son casos notificados al boletín epidemiológico (no todos los enfermos se diagnostican ni se reportan) y las últimas semanas pueden corregirse. Es información estadística, no consejo médico._');
  return lineas;
}

/** Confiabilidad de una serie de los cuatro originales: motor elegido fuera de muestra y su seguimiento semanal. */
export function confiabilidadLegacy(x, zz) {
  const o = x.oos;
  const comprobado = o.semanas
    ? ` Desde que se emitió, en ${o.semanas === 1 ? 'la semana comprobada' : `las ${o.semanas} semanas comprobadas`} esperaba ${casos(o.pronostico_total)} y llegaron ${ent0(o.observado_total)}` +
      (o.observado_total < 10 && o.pronostico_total < 10 ? '.'
        : Math.abs(o.sesgo_pct) >= 1 ? ` (${o.sesgo_pct > 0 ? 'se pasó' : 'se quedó corto'} ${pct0(o.sesgo_pct)}).` : ', prácticamente lo mismo.')
    : '';
  const nivel = o.semanas >= 2 && Math.abs(o.sesgo_pct) > 20 && Math.max(o.observado_total, o.pronostico_total) >= 10 ? 'baja' : 'media';
  const sinRango = zz.intervalo_disponible ? '' : ' Es una cifra única, sin rango de error.';
  return `**Confiabilidad: ${nivel}.** El motor de esta serie se eligió por su error con datos que no vio (semanas 28 a 37 de 2026).${comprobado}${sinRango}`;
}

/** Botones de seguimiento según la serie consultada (marcador SIGUE que lee app.js). */
export function siguientes(r, x, sinSexo) {
  const c = r.consultaVisible || r.consulta;
  const s = [];
  if (x.nivel === 'nacional') s.push({ t: '¿Dónde hay más casos?', q: `estados con mas casos de ${c}` });
  else s.push({ t: 'Ver el total nacional', q: `${c} nacional` });
  if (!sinSexo && x.sexo === 'general') s.push({ t: '¿Y en mujeres?', q: `${c}${x.nivel === 'estado' ? ` en ${nombreEstado(x.nombre)}` : ''} mujeres` });
  s.push({ t: 'Semana a semana', q: `zoom ${c}${x.nivel === 'estado' ? ` en ${nombreEstado(x.nombre)}` : ''}` });
  s.push({ t: '¿Qué tan confiable es?', q: `que tan confiable es el pronostico de ${c}` });
  return `\n<!--SIGUE:${JSON.stringify(s.slice(0, 4))}-->`;
}

/** Enlace a MedlinePlus en español para saber qué es un padecimiento (fuente pública de la Biblioteca Nacional de Medicina de EE. UU.). */
export function enlaceDefinicion(nombre) {
  return `https://vsearch.nlm.nih.gov/vivisimo/cgi-bin/query-meta?v%3Aproject=medlineplus-spanish&query=${encodeURIComponent(nombre)}`;
}
