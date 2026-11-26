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

/* Semana epidemiológica (domingo a sábado, regla del 4 de enero) de una fecha de la serie: las vistas fechan el lunes y los
 * originales el domingo; ambos caen en la misma semana. */
const inicioAnioEpi = (y) => { const j4 = Date.UTC(y, 0, 4); return j4 - new Date(j4).getUTCDay() * DIA; };
export function semanaEpi(ds) {
  const t = Date.parse(`${ds}T00:00:00Z`);
  const dom = t - new Date(t).getUTCDay() * DIA;
  let y = new Date(dom).getUTCFullYear() + 1;
  while (inicioAnioEpi(y) > dom) y--;
  return [y, Math.floor((dom - inicioAnioEpi(y)) / (7 * DIA)) + 1];
}

const isoDe = (t) => new Date(t).toISOString().slice(0, 10);
/** «25 al 31 de octubre de 2026», «29 de noviembre al 5 de diciembre de 2026» o «27 de diciembre de 2026 al 2 de enero de 2027». */
export function rangoSemana(d0, d6) {
  if (d0.slice(0, 7) === d6.slice(0, 7)) return `${Number(d0.slice(8))} al ${fechaLarga(d6)}`;
  if (d0.slice(0, 4) === d6.slice(0, 4)) return `${fechaLarga(d0).replace(/ de \d{4}$/, '')} al ${fechaLarga(d6)}`;
  return `${fechaLarga(d0)} al ${fechaLarga(d6)}`;
}
/**
 * Plan canónico 2.3 (26-nov-2026): un solo formato de semana en el texto, «semana 43 (25 al 31 de octubre de 2026)», para la
 * semana epidemiológica que contiene `ds`. El año epidemiológico se dice sólo si no es el del último día de la semana.
 */
export function semanaTxt(ds) {
  const [y, n] = semanaEpi(ds);
  const ini = inicioAnioEpi(y) + (n - 1) * 7 * DIA;
  const d0 = isoDe(ini), d6 = isoDe(ini + 6 * DIA);
  return `semana ${n}${Number(d6.slice(0, 4)) === y ? '' : ` de ${y}`} (${rangoSemana(d0, d6)})`;
}
/** «2026-W42» (etiqueta interna MMWR) → «semana 42 (18 al 24 de octubre de 2026)»; otra cosa queda igual. */
export function semanaDeEtiqueta(et) {
  const m = String(et).match(/^(\d{4})-W(\d{1,2})$/);
  return m ? semanaTxt(isoDe(inicioAnioEpi(Number(m[1])) + (Number(m[2]) - 1) * 7 * DIA)) : String(et);
}

/** Indicadores de una serie de la vista. */
export function indicadores(v, x) {
  const obs = x.observado || [];
  if (!obs.length) return null;
  const ultimo = obs.at(-1)[0];
  const mapa = new Map(obs);
  const ult4 = obs.slice(-4);
  const O4 = suma(ult4);
  // Plan canónico 1.4 (26-nov-2026, Codex Sol): el año anterior se compara por semana epidemiológica homóloga, no restando
  // 364 días (2025 tuvo 53 semanas y la resta comparaba W40–W43 de 2026 con W41–W44 de 2025).
  const porSemana = new Map(obs.map(([ds, y]) => [semanaEpi(ds).join('-'), y]));
  const previas = ult4.map(([ds]) => { const [a, w] = semanaEpi(ds); return porSemana.get(`${a - 1}-${w}`); });
  const O4py = previas.every((y) => y != null) ? previas.reduce((a, y) => a + y, 0) : null;
  const fut = (x.pronostico || []).filter(([ds]) => ds > ultimo);
  const F4 = fut.length >= 4 ? suma(fut.slice(0, 4)) : null;
  const [anioEpi, semUlt] = semanaEpi(ultimo);
  const anio = String(anioEpi);
  const ytd = suma(obs.filter(([ds]) => semanaEpi(ds)[0] === anioEpi));
  const tienePrevioCompleto = porSemana.has(`${anioEpi - 1}-1`);
  const ytdPrevio = tienePrevioCompleto
    ? suma(obs.filter(([ds]) => { const [a, w] = semanaEpi(ds); return a === anioEpi - 1 && w <= semUlt; }))
    : null;
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
    // Plan canónico 1.5: con una sola semana comprobada también cuenta, si suma al menos 20 casos (hepatitis A se pasó 136 % en
    // su única semana y su +68 % previsto no es una señal confiable).
    const o1 = x.oos || {};
    const s = o1.semanas >= 2 || (o1.semanas === 1 && (o1.observado_total || 0) + (o1.pronostico_total || 0) >= 20) ? o1.sesgo_pct : null;
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

/**
 * «Esperaba N casos y llegaron M (se pasó X %).» Plan canónico 2.4: un desvío de más de 300 % se dice sólo en casos («esperaba
 * 68 y llegaron 2»), porque un porcentaje así no se entiende.
 */
export function comprobadoTxt(o, cuando) {
  const p = Math.abs(o.sesgo_pct);
  const cola = o.observado_total < 10 && o.pronostico_total < 10 ? '.'
    : p > 300 ? '.'
      : p >= 1 ? ` (${o.sesgo_pct > 0 ? 'se pasó' : 'se quedó corto'} ${pct0(o.sesgo_pct)}).` : ', prácticamente lo mismo.';
  return `${cuando} esperaba ${casos(o.pronostico_total)} y llegaron ${ent0(o.observado_total)}${cola}`;
}

/** Confiabilidad en tres niveles, con su explicación en lenguaje llano. */
export function confiabilidad(v, x, esControl, r = null) {
  const o = x.oos || {};
  const comprobado = o.semanas ? ` ${comprobadoTxt(o, `En ${o.semanas === 1 ? 'la semana ya comprobada' : `las ${o.semanas} semanas ya comprobadas`}`)}` : '';
  const sinRango = /sin interval/i.test(v.uncertainty_label || '') ? ' Es una cifra única, sin rango de error.' : '';
  // Plan canónico 2.4: la parte llana lleva la versión breve (nivel, motivo corto y lo comprobado); la explicación completa
  // queda para «¿qué tan confiable es?» y la cifra única, sin rango, para la ficha plegada.
  const conBreve = (nivel, texto, motivo) => ({ nivel, texto, breve: `**Confiabilidad: ${nivel}.**${motivo ? ` ${motivo}` : ''}${comprobado}` });
  if (esControl) {
    return conBreve('baja', `**Confiabilidad: baja.** No es un modelo validado: repite lo ocurrido en las mismas semanas del año anterior, porque el modelo probado no lo mejoró en su prueba de aceptación.${comprobado}${sinRango}`,
      'No es un modelo validado: repite el año anterior.');
  }
  if (v.verdict === 'FAIL') {
    return conBreve('baja', `**Confiabilidad: baja.** No superó la comprobación con datos reales posteriores a su emisión.${comprobado}${sinRango}`,
      'No superó la comprobación con datos reales.');
  }
  // Plan canónico 1.5: también con una sola semana, si el desvío es grande (más de 50 %) y hay al menos 20 casos.
  const desvio2 = o.semanas >= 2 && Math.abs(o.sesgo_pct) > 20 && Math.max(o.observado_total, o.pronostico_total) >= 10;
  const desvio1 = o.semanas === 1 && Math.abs(o.sesgo_pct) > 50 && (o.observado_total || 0) + (o.pronostico_total || 0) >= 20;
  if (desvio2 || desvio1) {
    const r0 = conBreve('baja', `**Confiabilidad: baja aquí.** El modelo superó su prueba de aceptación, pero en esta serie se ha desviado.${comprobado}${sinRango}`,
      'El modelo superó su prueba, pero en esta serie se ha desviado.');
    return { ...r0, breve: r0.breve.replace('**Confiabilidad: baja.**', '**Confiabilidad: baja aquí.**') };
  }
  if (v.verdict === 'PASS') {
    // PASS significa que no fue peor que el control en las 4 semanas, no que acertara (dictamen de Fable).
    return conBreve('alta', `**Confiabilidad: alta.** Superó su prueba de aceptación y, en las ${v.weeks_required} semanas reales que siguieron a su emisión, no fue peor que el control estacional.${comprobado}${sinRango}`,
      'Superó su prueba de aceptación y, con datos reales, no fue peor que el control estacional.');
  }
  const np = r?.no_prospectivas?.length
    ? ` De ellas, la ${r.no_prospectivas.map(semanaDeEtiqueta).join(', la ')} ${r.no_prospectivas.length === 1 ? 'ya era pública al emitir y no cuenta como prospectiva' : 'ya eran públicas al emitir y no cuentan como prospectivas'}.`
    : '';
  return conBreve('media', `**Confiabilidad: media.** Superó su prueba de aceptación con datos que no vio; la comprobación con datos reales va en ${v.weeks_available} de ${v.weeks_required} semanas.${np}${comprobado}${sinRango}`,
    `Superó su prueba de aceptación (comprobación: ${v.weeks_available} de ${v.weeks_required} semanas).`);
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
    return `**El pico esperado en los próximos 12 meses** es la ${semanaTxt(ind.pico[0])}, con unos **${casos(ind.pico[1])}**${lugar}.`;
  }
  if (p.tipo === 'semana') {
    const [ds, y] = x.observado.at(-1);
    return `**En la última semana con datos** (la ${semanaTxt(ds)}) se notificaron **${casos(y)}**${lugar}.`;
  }
  if (p.tipo === 'semana_n') {
    // Semana epidemiológica de domingo a sábado (regla del 4 de enero); las fechas de la serie caen dentro de ella.
    const a = p.anio ?? Number(ind.anio);
    const j4 = Date.UTC(a, 0, 4), ini = j4 - new Date(j4).getUTCDay() * DIA + (p.semana - 1) * 7 * DIA;
    const d0 = new Date(ini).toISOString().slice(0, 10), d6 = new Date(ini + 6 * DIA).toISOString().slice(0, 10);
    const enSemana = ([ds]) => ds >= d0 && ds <= d6;
    const rango = rangoSemana(d0, d6);
    const o = (x.observado || []).find(enSemana);
    if (o && o[1] != null) return `**En la semana ${p.semana} de ${a}** (${rango}) se notificaron **${casos(o[1])}**${lugar}.`;
    const f = (x.pronostico || []).find(enSemana);
    const ultimo = x.observado.at(-1)[0];
    if (f && f[0] > ultimo) return `**La semana ${p.semana} de ${a}** (${rango}) **aún no tiene dato** en el boletín: la última con datos es la ${semanaTxt(ultimo)}. Para esa semana se esperan unos **${casos(f[1])}**${lugar}.`;
    return null;
  }
  if (p.tipo === 'horizonte') {
    // Originales: sólo el horizonte posterior al corte del modelo (antes es el ajuste histórico, no pronóstico).
    const pr = (x.pronostico || []).filter(([ds]) => !x.dsCorte || ds > x.dsCorte);
    if (!pr.length) return null;
    const total = Number.isFinite(x.pronostico_52_total) ? x.pronostico_52_total : suma(pr);
    return `**En las ${pr.length} semanas del pronóstico**, de la ${semanaTxt(pr[0][0])} a la ${semanaTxt(pr.at(-1)[0])}, se esperan unos **${casos(total)}**${lugar}.`;
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
export function respuestaLlana({ v, x, r, q, esControl, estados, sinSexo, confianzaTexto, compacto = false }) {
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
    incierto: `no hay una señal clara de cambio: el pronóstico espera unos ${casos(ind.F4)} en las próximas 4 semanas (${d >= 0 ? '+' : '−'}${pct0((d ?? 0) * 100)}), pero en ${x.oos.semanas === 1 ? 'la semana ya comprobada' : 'las semanas ya comprobadas'} ${Math.abs(x.oos.sesgo_pct) > 300 ? `esperaba ${casos(x.oos.pronostico_total)} y llegaron ${ent0(x.oos.observado_total)}, un desvío mayor que ese cambio` : `se ha ${x.oos.sesgo_pct > 0 ? 'pasado' : 'quedado corto'} por ${pct0(x.oos.sesgo_pct)}, tanto como ese cambio`}.`,
  }[ind.tendencia];
  let sino = '';
  // Plan canónico 1.1 (26-nov-2026): «Sí.» o «No.» sólo contesta una pregunta de sí o no («¿sube…?»), nunca «¿dónde…?»,
  // «¿cuántos…?» o «¿qué estados…?», y nunca con un control estacional ni con confiabilidad baja (no hay certeza que dar).
  const abierta = /\b(donde|cuantos?|cuantas?|cuales?|que estados?|en que|cuando|como|por ?que|que tan)\b/.test(norm(q));
  const certeza = !c && confiabilidad(v, x, esControl).nivel !== 'baja';
  if (pidio && !abierta && certeza && !preguntaPorBrote(norm(q)) && !['incierto', 'atipico', 'pocos'].includes(ind.tendencia)) sino = ind.tendencia === pidio ? 'Sí. ' : 'No. ';
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
  // Plan canónico 2.4: si la pregunta ya tiene su respuesta arriba (un periodo pedido o «¿qué es…?»), las viñetas pasan a la
  // ficha plegada y a la vista quedan la respuesta, la tendencia y la confiabilidad.
  const inicioVinetas = lineas.length;
  const compactar = compacto || !!periodo;
  const ventanaTxt = v.observation_cutoff && v.observation_cutoff[1] >= 4
    ? `semanas ${v.observation_cutoff[1] - 3} a ${v.observation_cutoff[1]} de ${v.observation_cutoff[0]}`
    : `4 semanas hasta la ${semanaTxt(ind.ultimo)}`;
  const vsPrevio = ind.O4py != null && ind.O4py > 0
    ? (Math.abs(ind.O4 / ind.O4py - 1) < 0.005 ? `, igual que en las mismas semanas de ${Number(ind.anio) - 1}`
      : `, ${ind.O4 >= ind.O4py ? `${pct0((ind.O4 / ind.O4py - 1) * 100)} más` : `${pct0((1 - ind.O4 / ind.O4py) * 100)} menos`} que en las mismas semanas de ${Number(ind.anio) - 1} (${ent0(ind.O4py)})`)
    : '';
  // Plan canónico 2.4: la frase principal ya da los casos de las 4 semanas anteriores; «Ahora» sólo los repite cuando la frase
  // no los dice («sin señal clara») y, si no, da la ventana y la comparación con el año anterior.
  const repite = ['sube', 'baja', 'estable', 'pocos', 'atipico'].includes(ind.tendencia) && ind.F4 != null;
  lineas.push(repite
    ? (ind.O4py > 0 ? `- **Frente a ${Number(ind.anio) - 1}:** ${vsPrevio.replace(/^, /, '').replace('en las mismas semanas', 'en las mismas 4 semanas')}.` : `- **Datos hasta:** la ${semanaTxt(ind.ultimo)}.`)
    : `- **Ahora:** ${casos(ind.O4)} en las ${ventanaTxt}${vsPrevio}.`);
  const vsYtd = ind.ytdPrevio ? `, ${ind.ytd >= ind.ytdPrevio ? `${pct0((ind.ytd / ind.ytdPrevio - 1) * 100)} más` : `${pct0((1 - ind.ytd / ind.ytdPrevio) * 100)} menos`} que a la misma fecha de ${Number(ind.anio) - 1}` : '';
  // Plan canónico 2.4: a la vista, tres viñetas como máximo (ahora, el año y dónde); el pico esperado y la aclaración de que el
  // año es la suma de las semanas de la serie pasan a la ficha plegada (`lineas.aparte`).
  lineas.push(`- **En lo que va de ${ind.anio}:** ${casos(ind.ytd)}${vsYtd}.`);
  const aparte = [];
  if (ind.pico && ind.promedioFut > 0 && ind.pico[1] >= 1.25 * ind.promedioFut && ind.pico[1] >= 10 && ind.pico[0] > isoMenos(ind.fut[Math.min(4, ind.fut.length - 1)][0], 0)) {
    aparte.push(`- **Pico esperado en los próximos 12 meses:** la ${semanaTxt(ind.pico[0])}, con unos ${casos(ind.pico[1])}.`);
  }
  aparte.push(`- «En lo que va de ${ind.anio}» es la suma de las semanas de la serie publicada; el acumulado que imprime el boletín puede diferir un poco por correcciones.`,
    '- No todos los enfermos se diagnostican ni se reportan: son casos notificados al sistema de vigilancia.');
  if (estados && estados.length) {
    const conF4 = estados.map((e) => ({ e, f: suma((e.pronostico || []).filter(([ds]) => ds > ind.ultimo).slice(0, 4)) }))
      .sort((a, b) => b.f - a.f);
    if (x.nivel === 'estado') {
      const i = conF4.findIndex((y) => y.e.id === x.id);
      if (i >= 0 && conF4[0].f > 0) lineas.push(`- **Lugar en el país:** ${i + 1}.º de ${conF4.length} por casos esperados, sin ajustar por población.`);
    } else if (x.nivel === 'nacional') {
      const top = conF4.filter((y) => y.f > 0).slice(0, 3);
      if (top.length) lineas.push(`- **Dónde se esperan más:** ${top.map((y) => `${nombreEstado(y.e.nombre)} (${ent0(y.f)})`).join(', ')}, sin ajustar por población.`);
    }
  }
  if (compactar) aparte.unshift(...lineas.splice(inicioVinetas).filter((l) => l.startsWith('- ')), '');
  const conf = confiabilidad(v, x, esControl, r);
  lineas.push(...(compactar ? [] : ['']), confianzaTexto || conf.breve || conf.texto, '', PIE_LLANO);
  lineas.aparte = aparte;
  return lineas;
}

/** El único pie de la respuesta llana (plan canónico 2.4). */
export const PIE_LLANO = '_Casos notificados al boletín; las últimas semanas pueden corregirse. No es consejo médico._';

/** Confiabilidad de una serie de los cuatro originales: motor elegido fuera de muestra y su seguimiento semanal. */
export function confiabilidadLegacy(x, zz, completo = false) {
  const o = x.oos;
  const comprobado = o.semanas ? ` ${comprobadoTxt(o, `Desde que se emitió, en ${o.semanas === 1 ? 'la semana comprobada' : `las ${o.semanas} semanas comprobadas`}`)}` : '';
  const nivel = o.semanas >= 2 && Math.abs(o.sesgo_pct) > 20 && Math.max(o.observado_total, o.pronostico_total) >= 10 ? 'baja' : 'media';
  const sinRango = zz.intervalo_disponible ? '' : ' Es una cifra única, sin rango de error.';
  // Plan canónico 2.4: en la parte llana basta el nivel y lo comprobado; cómo se eligió el motor y la cifra única van en la
  // ficha plegada («Cómo se calculó»), salvo que se pida la versión completa.
  if (!completo) return `**Confiabilidad: ${nivel}.**${comprobado}`;
  return `**Confiabilidad: ${nivel}.** El motor de esta serie se eligió por su error con datos que no vio (semanas 28 a 37 de 2026).${comprobado}${sinRango}`;
}

/**
 * Plan canónico 2.6: «¿cuántos casos habrá?» sin periodo se contesta con las próximas 4 semanas (lo dice la respuesta) y
 * ofrece dos botones para el otro sentido posible: las 52 semanas del pronóstico y el mes siguiente.
 */
export function botonesPeriodo(q, c, x) {
  const n = ` ${norm(q || '').replace(/[^a-z0-9]+/g, ' ')} `;
  if (!/ (cuantos|cuantas|habra|habran|va a haber|van a haber|se esperan?|pronostico|pronostican|cuanto) /.test(n) || periodoPedido(q)) return [];
  const lugar = x.nivel === 'estado' ? ` en ${nombreEstado(x.nombre)}` : '';
  const sexo = x.sexo === 'hombres' || x.sexo === 'mujeres' ? ` ${x.sexo}` : '';
  const ult = x.observado?.at(-1)?.[0];
  const ini = (x.pronostico || []).find(([ds]) => !ult || ds > ult)?.[0];
  const out = [{ t: 'En las 52 semanas', q: `cuantos casos de ${c}${lugar}${sexo} se pronostican en 52 semanas` }];
  if (ini) {
    const [a, m] = ini.split('-').map(Number);
    const mes = m % 12, anio = m === 12 ? a + 1 : a;
    out.push({ t: `En ${MESES[mes]}`, q: `cuantos casos de ${c}${lugar}${sexo} en ${MESES[mes]} de ${anio}` });
  }
  return out;
}

/** Botones de seguimiento según la serie consultada (marcador SIGUE que lee app.js). */
export function siguientes(r, x, sinSexo, q = '') {
  const c = r.consultaVisible || r.consulta;
  const s = [...botonesPeriodo(q, c, x)];
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
