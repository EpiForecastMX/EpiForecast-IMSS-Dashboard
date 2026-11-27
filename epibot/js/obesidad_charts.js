/**
 * obesidad_charts.js — C7.7: gráficas del EpiBot para Obesidad (E66) desde su vista publicada.
 *
 * Obesidad no vive en prod_models/weekly_comparison/zoom_series (esos son los padecimientos del
 * carril legacy). Sin este módulo, «zoom obesidad» caía en las gráficas genéricas y pintaba datos
 * de Depresión. Aquí:
 *
 *  - `tipoGraficaObesidad(qn)` clasifica la petición (UNA sola vez, compartida por el texto de
 *    kb.js y por la gráfica de app.js, para que ambos digan lo mismo);
 *  - `graficaObesidad(v, qn, ent)` la construye con `publication_view.v1` en los formatos que ya
 *    pinta app.js (Chart.js o `_mapChart`), o devuelve null cuando no aplica;
 *  - `NO_DISPONIBLE` explica las gráficas que no existen para un release puntual (sin bandas,
 *    sin semáforo, sin timelapse): nunca se sustituyen por datos de otro padecimiento.
 *
 * Vale para cualquier release publicado: título y color salen de `release_config.js` por
 * `disease_id`. Funciones puras: sin DOM, sin fetch.
 */
import { RELEASES, releaseDeId } from './release_config.js?v=60';
import { semanaSiguiente } from './calendario_boletin.js?v=2';
import { semanaTxt } from './resumen_llano.js?v=11';

const strip = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const has = (q, ks) => ks.some((k) => q.includes(k));

export const MOTOR_NOMBRE = {
  ets_add_damped_log1p: 'ETS amortiguado (log)',
  prophet_count_log1p: 'Prophet en conteos (log)',
  prophet_rate_log1p: 'Prophet en tasa (log)',
  ridge_harmonic_log1p: 'Ridge armónico (log)',
  seasonal_naive_lag52: 'naive estacional (lag 52)',
  seasonal_mean_3y: 'media estacional de 3 años',
  seasonal_median_3y: 'mediana estacional de 3 años',
  seasonal_mean_5y: 'media estacional de 5 años',
  seasonal_median_5y: 'mediana estacional de 5 años',
  seasonal_mean_2y: 'media estacional de 2 años',
  portfolio: 'portafolio (suma de las series estatales)',
};

/** Orden de prioridad: lo más específico primero. */
const REGLAS = [
  ['timelapse', ['timelapse', 'mapa animado', 'animacion', 'animado']],
  ['semaforo', ['semaforo', 'nivel de riesgo', 'alerta epidemiolog']],
  ['pdf', ['reporte pdf', 'reporte ejecutivo', 'pdf', 'exportar', 'descargar']],
  // Rediseño conversacional: «¿qué tan confiable es?» pide la confiabilidad en lenguaje llano, no la banda.
  ['confianza', ['confiable', 'confiabilidad', 'fiable', 'que tan bueno', 'que tan preciso', 'que tan exacto', 'le atina', 'que tan cierto', 'puedo creer', 'creible', 'confiar', 'son precisos', 'son precisas', 'es preciso', 'es precisa', 'son exactos', 'que tan buena', 'precision de ese', 'precision de este', 'precision del pronostico', 'precision de esa']],
  ['banda', ['corredor', 'confianza', 'banda', 'intervalo', 'incertidumbre']],
  ['heatmap', ['heatmap', 'mapa de calor', 'error semanal', 'diferencias del seguimiento']],
  ['entidades', ['treemap', 'mapa de entidad', 'por entidad', 'panorama', 'casos por estado']],
  ['mapa', ['mapa', 'coropletico', 'geografico']],
  // Rediseño conversacional: la precisión por estado va primero; «top 5 estados con más casos» o «ranking de entidades por
  // casos» piden estados con más casos, no precisión.
  ['ranking', ['precis', 'acierta', 'falla', 'mejores y peores', 'mas preciso', 'menos preciso']],
  ['entidades', ['que estado', 'cual estado', 'cuales estados', 'que estados', 'mas casos', 'mayor numero', 'donde hay mas', 'estados con', 'entidades con',
    'entidades por', 'estados por', 'ranking de entidades', 'ranking de estados', 'top 5 estados', 'top 10 estados', 'mayor incremento', 'mas aumento',
    // Plan canónico 2.1: «¿dónde sube más rápido?» pide estados ordenados por cambio, no el total nacional.
    'donde sube', 'donde aumenta', 'donde crece', 'donde baja', 'donde disminuye', 'en que estado sube', 'en que estados sube']],
  // «¿está peor?» pregunta por la tendencia, no por la precisión: «mejor» y «peor» sólo cuentan referidos a estados o modelos.
  ['ranking', ['mejores y peores', 'ranking', 'top ', 'mejores estados', 'peores estados', 'estado mejor', 'estado peor', 'mejor pronostic', 'peor pronostic', 'precis', 'acierta', 'falla']],
  ['calibracion', ['calibracion', 'calibrado', 'real vs pronostico', 'observado vs pronostico']],
  ['volumen_error', ['volumen vs error', 'volumen y error', 'burbuja', 'scatter', 'dispersion', 'matriz']],
  ['acumulado', ['acumulad', 'cascada', 'waterfall', 'aporte']],
  ['sexo', ['apilad', 'stacked', 'composicion', 'por sexo', 'hombres y mujeres', 'hombres vs mujeres', 'mujeres y hombres', 'mujeres vs hombres']],
  ['motores', ['motor', 'arsenal', 'polar', 'rosa de']],
  ['comparador', ['comparador', 'comparar', 'compara ', 'comparame', 'comparalo', 'comparativo', 'comparativa entre', 'comparacion de estados', 'comparacion entre', 'sparkline', 'mini grafic', ' vs ', ' contra ']],
  ['metricas', ['radar', 'spider', 'boxplot', 'box plot', 'caja y bigotes', 'gauge', 'medidor', 'velocimetro', 'salud de los modelos', 'salud de modelos', 'mase']],
  ['seguimiento', ['zoom', 'detalle semanal', 'seguimiento', 'validacion', 'cercano', 'ultimas semanas', 'semana a semana']],
];

export function tipoGraficaObesidad(qn) {
  const q = ` ${strip(qn)} `;
  for (const [tipo, ks] of REGLAS) if (has(q, ks)) return tipo;
  return 'serie';
}

/** El tipo que responden texto y gráfica: «motor» con estado o sexo es el de ESA serie. */
export function tipoEfectivo(qn, ent = {}) {
  const tipo = tipoGraficaObesidad(qn);
  return tipo === 'motores' && (ent.estado || ent.sexo) ? 'motor_serie' : tipo;
}

/** «emitido el 24 de julio de 2026» (hora de la Ciudad de México), desde la vista. */
export function emisionTxt(v) {
  if (!v || !v.forecast_emitted_at) return 'emitido una sola vez';
  const f = new Date(v.forecast_emitted_at).toLocaleDateString('es-MX', { timeZone: 'America/Mexico_City', day: 'numeric', month: 'long', year: 'numeric' });
  return `emitido el ${f}`;
}

export const NO_DISPONIBLE = {
  timelapse: 'El **timelapse** necesita una serie de mapas semanales con el mismo motor en todos los estados; Obesidad se publica como un pronóstico congelado y no tiene esa animación.',
  semaforo: 'El **semáforo epidemiológico** usa umbrales de riesgo definidos para los padecimientos del carril semanal; para Obesidad no hay umbrales validados y no se calcula un nivel de riesgo.',
  pdf: 'El **reporte ejecutivo en PDF** cubre los padecimientos del carril semanal; Obesidad aún no está incluida.',
  heatmap: 'El **mapa de calor del error semanal** compara rondas de seguimiento del carril semanal; Obesidad tiene un único pronóstico congelado, así que su error se resume por estado.',
  metricas: 'Esa gráfica resume las **métricas de selección** de los motores del carril semanal. En Obesidad el motor de cada serie se eligió con validación cruzada temporal en pliegues de 2021 a 2024, y aquí se publica sólo el desempeño frente a lo observado después de emitir el pronóstico.',
};

/** El texto de una gráfica no disponible, con el nombre del padecimiento consultado. */
/** `seleccion` sustituye «en pliegues de 2021 a 2024» en los releases de historia corta. */
export const noDisponible = (tipo, nombre, seleccion) => NO_DISPONIBLE[tipo].replaceAll('Obesidad', nombre)
  .replaceAll('en pliegues de 2021 a 2024', seleccion || 'en pliegues de 2021 a 2024');

/** Consultas sugeridas; sin semanas observadas no se ofrecen las de error. */
export function alternativas(r, conOos = true) {
  const c = r.consulta;
  const ops = conOos
    ? [`«zoom ${c}»`, `«mapa de ${c}»`, `«ranking de ${c}»`, `«calibración de ${c}»`]
    : [`«zoom ${c}»`, `«mapa de ${c}»`, `«acumulado de ${c}»`, `«motores de ${c}»`];
  return `${ops.join(', ')} ${c.startsWith('o') ? 'u' : 'o'} «${c} por sexo»`;
}

export const ALTERNATIVAS = alternativas(RELEASES[0]);

// --- utilidades -------------------------------------------------------------

const SEXO_NOMBRE = { general: 'ambos sexos', hombres: 'hombres', mujeres: 'mujeres' };
// Paleta categórica validada para fondo claro (mesa de gráficas, 25-nov-2026; validate_palette.js: CVD y visión normal PASS,
// tres tonos bajo 3:1 compensados con leyenda y tabla). Orden fijo: el color sigue a la entidad, nunca al rango.
const PALETA = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];
/** Un color de trazo con contraste de al menos 3:1 sobre blanco: los tonos claros del catálogo (lima, rosa) se oscurecen. */
export function legible(hex, minimo = 3) {
  const m = /^#?([0-9a-f]{6})/i.exec(String(hex || ''));
  if (!m) return hex;
  let [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  const lum = (c) => { const x = c / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  const contraste = () => 1.05 / (0.2126 * lum(r) + 0.7152 * lum(g) + 0.0722 * lum(b) + 0.05);
  for (let i = 0; i < 20 && contraste() < minimo; i++) { r = Math.round(r * 0.9); g = Math.round(g * 0.9); b = Math.round(b * 0.9); }
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
const GRIS_CONTROL = '#6b6f73';
/** Control estacional: el portafolio se rechazó y se publica lo ocurrido un año antes (nunca validado). */
const esControlV = (v) => !!v?.caida_al_control || v?.portafolio_igual_al_control === true;

function estados(v, sexo) {
  return Object.values(v.series).filter((x) => x.nivel === 'estado' && x.sexo === sexo);
}

/** Serie pedida: estado detectado o Nacional; sexo detectado o General. */
export function serieObesidad(v, ent = {}) {
  const sexo = ent.sexo || 'general';
  if (ent.estado) {
    const hit = estados(v, sexo).find((x) => strip(x.nombre) === strip(ent.estado));
    if (hit) return hit;
  }
  return v.series[`nacional|mx|${sexo}`];
}

/** Estados nombrados en la consulta (para el comparador), en orden de aparición. */
export function estadosEnConsulta(v, qn) {
  let q = ` ${strip(qn).replace(/[^a-z0-9 ]/g, ' ')} `;
  const alias = { cdmx: 'Ciudad de México', edomex: 'México', 'estado de mexico': 'México' };
  const hallados = [];
  for (const [a, nombre] of Object.entries(alias)) {
    if (q.includes(` ${a} `)) { hallados.push([q.indexOf(` ${a} `), nombre]); q = q.replace(` ${a} `, ' # '); }
  }
  const nombres = estados(v, 'general').map((x) => x.nombre).sort((a, b) => b.length - a.length);
  for (const nombre of nombres) {
    const k = ` ${strip(nombre)} `;
    if (k === ' mexico ') continue; // ambiguo con el país: sólo por alias
    if (q.includes(k)) { hallados.push([q.indexOf(k), nombre]); q = q.replace(k, ' # '); }
  }
  return [...new Set(hallados.sort((a, b) => a[0] - b[0]).map((h) => h[1]))];
}

const et = (v) => (releaseDeId(v.disease_id) || RELEASES[0]).etiqueta;
const colorDe = (v) => legible(releaseDeId(v.disease_id)?.color || v.color || PALETA[0]);
const lugarDe = (x) => (x.nivel === 'nacional' ? 'Nacional' : x.nombre);
const semana = ([a, w]) => `semana ${w} de ${a}`;
/** Plan canónico 2.3: «semanas 42 a 43 de 2026», «semana 44 de 2026» o «semana 53 de 2025 a semana 1 de 2026», sin la etiqueta ISO. */
const rangoSemanas = ([a1, w1], [a2, w2]) => (a1 === a2 && w1 === w2 ? semana([a1, w1])
  : a1 === a2 ? `semanas ${w1} a ${w2} de ${a1}` : `${semana([a1, w1])} a ${semana([a2, w2])}`);

// Título en tinta oscura (antes un gris casi blanco del tema oscuro, invisible sobre el fondo claro del EpiBot).
function titulo(lineas) {
  return { title: { display: true, text: lineas, font: { size: 13, weight: '700', family: 'system-ui' }, color: '#173c33', align: 'start', padding: { bottom: 10, top: 4 } } };
}
const EJE_Y_SEMANAL = { y: { title: { display: true, text: 'Casos notificados por semana' } } };
// Leyenda corta (en celular la larga se cortaba); la explicación completa va en la tercera línea del título.
const leyendaPron = (v) => (esControlV(v) ? 'Control, no validado' : `Pronóstico (datos hasta la ${semana(v.origin)})`);
const notaPron = (v) => (esControlV(v) ? 'Control estacional (repite el año anterior), no validado · sin intervalos' : 'Pronóstico puntual, sin intervalos');

function lineaObsPron(v, x, desde, hasta, color) {
  const obs = new Map(x.observado);
  const pron = new Map(x.pronostico);
  const labels = [...new Set([...obs.keys(), ...pron.keys()])].filter((d) => d >= desde && d <= hasta).sort();
  return {
    labels,
    datasets: [
      { label: 'Observado', data: labels.map((d) => obs.get(d) ?? null), borderColor: color, backgroundColor: color + '22', borderWidth: 2, pointRadius: 0, tension: 0, spanGaps: false, order: 1 },
      { label: leyendaPron(v), data: labels.map((d) => pron.get(d) ?? null), borderColor: esControlV(v) ? GRIS_CONTROL : color, borderDash: [7, 5], borderWidth: 2, pointRadius: 0, tension: 0, spanGaps: false, order: 2 },
    ],
    corte: x.observado.length ? x.observado.at(-1)[0] : null,
  };
}

function lineal(v, x, desde, hasta, encabezado) {
  const color = colorDe(v);
  const { labels, datasets, corte } = lineaObsPron(v, x, desde, hasta, color);
  return {
    type: 'line',
    title: `${et(v)} · ${lugarDe(x)} · ${x.sexo_nombre}: ${encabezado}`,
    labels,
    datasets,
    corte,
    options: { plugins: titulo([`${et(v)} · ${lugarDe(x)} · ${x.sexo_nombre}`, encabezado, notaPron(v)]), scales: EJE_Y_SEMANAL },
  };
}

// Una sola serie, un solo color (los tres colores por umbral no tenían leyenda). Los 32 nombres se ven: altura por fila.
function barrasEstados(v, filas, valor, etiqueta, encabezado, nota) {
  return {
    type: 'bar',
    horizontal: true,
    title: `${et(v)}: ${encabezado}`,
    labels: filas.map((x) => (x.nombre === 'México' ? 'Estado de México' : x.nombre)),
    datasets: [{ label: etiqueta, data: filas.map(valor), backgroundColor: PALETA[0], borderWidth: 0, borderRadius: 4 }],
    altura: filas.length * 22 + 110,
    options: { plugins: titulo([`${et(v)}: ${encabezado}`, ...(nota ? [nota] : [])]), scales: { y: { ticks: { autoSkip: false } }, x: { title: { display: true, text: etiqueta } } } },
  };
}

/**
 * Plan canónico 2.2 (26-nov-2026): la gráfica de estados con la misma ventana, el mismo orden y los mismos valores que el
 * texto (que los deja en el marcador). Antes el texto daba las próximas 4 semanas y la gráfica el total de 52, en otro orden.
 * En el ranking por volumen se destacan los estados que nombra el texto y el resto va en gris; en el ritmo, sólo los que el
 * texto compara, con el cambio porcentual.
 */
function barrasDelTexto(v, sexo, m) {
  const nombre = (n) => (n === 'México' ? 'Estado de México' : n);
  const filas = m.valores;
  const ctrl = esControlV(v) ? ' (control estacional, no validado)' : '';
  if (m.ventana === 'ritmo') {
    const enc = `dónde ${m.baja ? 'baja' : 'sube'} más rápido, ${SEXO_NOMBRE[sexo]}${ctrl}`;
    return {
      type: 'bar', horizontal: true, title: `${et(v)}: ${enc}`,
      labels: filas.map(([n]) => nombre(n)),
      datasets: [{ label: 'Cambio esperado (%)', data: filas.map(([, p]) => p), backgroundColor: esControlV(v) ? '#6b6f73' : (m.baja ? '#17644d' : '#b4541e'), borderWidth: 0, borderRadius: 4 }],
      altura: filas.length * 28 + 110,
      options: { plugins: titulo([`${et(v)}: ${enc}`, 'Próximas 4 semanas frente a las 4 anteriores; sólo estados con al menos 10 casos de base']),
        scales: { y: { ticks: { autoSkip: false } }, x: { title: { display: true, text: 'Cambio esperado (%)' } } } },
    };
  }
  const n = m.destacados || 5;
  const top = filas.slice(0, Math.max(10, n));
  const etiqueta = { f4: 'Casos esperados en las próximas 4 semanas', aumento: 'Aumento esperado (casos, próximas 4 semanas frente a las 4 anteriores)', ytd: `Casos en lo que va de ${m.anio || 'el año'}` }[m.ventana] || 'Casos';
  const enc = `${{ f4: 'estados con más casos esperados', aumento: 'estados donde más se espera que aumente', ytd: 'estados con más casos en lo que va del año' }[m.ventana] || 'estados'}, ${SEXO_NOMBRE[sexo]}${ctrl}`;
  return {
    type: 'bar', horizontal: true, title: `${et(v)}: ${enc}`,
    labels: top.map(([x]) => nombre(x)),
    datasets: [{ label: etiqueta, data: top.map(([, y]) => y), backgroundColor: top.map((_, i) => (i < n ? (esControlV(v) ? '#6b6f73' : colorDe(v)) : '#c9d1cd')), borderWidth: 0, borderRadius: 4 }],
    altura: top.length * 26 + 110,
    options: { plugins: titulo([`${et(v)}: ${enc}`, `Los ${top.length} con más casos; en color, los ${n} que nombra el texto. Casos notificados, sin ajustar por población`]),
      scales: { y: { ticks: { autoSkip: false } }, x: { title: { display: true, text: etiqueta } } } },
  };
}

// --- constructor ------------------------------------------------------------

/**
 * @param opciones  {tipo, estados} del marcador que deja la respuesta de texto (obesidad_kb.js): si
 *                  viene, manda, para que la gráfica sea la del texto aun en follow-ups.
 */
export function graficaObesidad(v, qn, ent = {}, opciones = {}) {
  if (!v || v.schema !== 'publication_view.v1') return null;
  const tipo = opciones.tipo || tipoEfectivo(qn, ent);
  const sexo = ent.sexo || 'general';
  const x = serieObesidad(v, ent);
  // Primera semana fuera de muestra = la siguiente al origen en el calendario MMWR (52 o 53 semanas).
  const oos = `fuera de muestra, ${rangoSemanas(semanaSiguiente(v.origin[0], v.origin[1], 1), v.observation_cutoff)}`;
  if (!x) return null;

  if (tipo in NO_DISPONIBLE) return null;
  if (tipo === 'serie' || tipo === 'confianza' || tipo === 'banda' || tipo === 'motor_serie') {
    return lineal(v, x, `${Math.max(v.origin[0] - 3, 2023)}-01-01`, '9999', `historia desde 2023 y ${v.horizon_weeks} semanas de pronóstico`);
  }
  if (tipo === 'seguimiento') {
    const ini = x.pronostico[0][0];
    const desde = new Date(Date.parse(ini) - 13 * 7 * 864e5).toISOString().slice(0, 10);
    const hasta = (x.pronostico.find(([d]) => d > v.observation_cutoff_ds) || x.pronostico.at(-1))[0];
    const fin = x.pronostico[Math.min(x.pronostico.findIndex(([d]) => d === hasta) + 7, x.pronostico.length - 1)][0];
    return lineal(v, x, desde, fin, `zoom semanal: observado frente al pronóstico desde la ${semanaTxt(x.pronostico[0][0])}`);
  }
  if (tipo === 'mapa') {
    const error = has(strip(qn), ['error', 'smape', 'precision', 'sesgo', 'desempeno']);
    if (error && !estados(v, sexo).some((e) => e.oos.smape != null)) return null;
    const stateData = {};
    // Plan canónico 2.2: si el texto dio un ranking (próximas 4 semanas, aumento o acumulado), el mapa pinta esos mismos valores.
    const VENTANA_MAPA = { f4: ['casos en las próximas 4 semanas', 'casos esperados en las próximas 4 semanas'], aumento: ['casos más que en las 4 anteriores', 'aumento esperado en las próximas 4 semanas'], ytd: [`casos en lo que va de ${opciones.anio || 'el año'}`, `casos en lo que va de ${opciones.anio || 'el año'}`] };
    if (!error && Array.isArray(opciones.valores) && VENTANA_MAPA[opciones.ventana]) {
      const [lbl, enc] = VENTANA_MAPA[opciones.ventana];
      for (const [n, val] of opciones.valores) {
        stateData[n.normalize('NFD').replace(/[\u0300-\u036f]/g, '')] = { value: val, label: `${Math.round(val).toLocaleString('es-MX')} ${lbl}` };
      }
      return { _mapChart: true, stateData, opts: { title: `${et(v)}, ${SEXO_NOMBRE[sexo]}: ${enc}${esControlV(v) ? ' (control estacional, no validado)' : ''} (sin ajustar por población)`, metric: 'casos' } };
    }
    for (const e of estados(v, sexo)) {
      const val = error ? e.oos.smape : e.pronostico_52_total;
      if (val == null) continue;
      // renderMexicoMap empareja por el nombre del SVG: el mismo nombre, sin tildes.
      stateData[e.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '')] = {
        value: Math.round(val * 10) / 10,
        label: error ? `sMAPE ${val.toFixed(1)} % (${oos})` : `${Math.round(val).toLocaleString('es-MX')} casos (${v.horizon_weeks} sem)`,
      };
    }
    return { _mapChart: true, stateData, opts: {
      title: error ? `${et(v)}, ${SEXO_NOMBRE[sexo]}: sMAPE ${oos}`
        : `${et(v)}, ${SEXO_NOMBRE[sexo]}: casos ${esControlV(v) ? 'del control estacional' : 'pronosticados'} en ${v.horizon_weeks} semanas (sin ajustar por población)`,
      metric: error ? 'sMAPE %' : 'casos' } };
  }
  if (tipo === 'entidades' && Array.isArray(opciones.valores) && opciones.valores.length) return barrasDelTexto(v, sexo, opciones);
  if (tipo === 'entidades') {
    const filas = estados(v, sexo).sort((a, b) => b.pronostico_52_total - a.pronostico_52_total);
    return barrasEstados(v, filas, (e) => Math.round(e.pronostico_52_total), `Casos en ${v.horizon_weeks} semanas`, `casos ${esControlV(v) ? 'del control estacional' : 'pronosticados'} por estado, ${SEXO_NOMBRE[sexo]}`, 'Casos notificados, sin ajustar por población');
  }
  if (tipo === 'ranking') {
    const filas = estados(v, sexo).filter((e) => e.oos.smape != null).sort((a, b) => a.oos.smape - b.oos.smape);
    if (!filas.length) return null;
    const n = Math.max(...filas.map((e) => e.oos.semanas || 0));
    return barrasEstados(v, filas, (e) => e.oos.smape, 'sMAPE (%)', `sMAPE por estado (${oos}), ${SEXO_NOMBRE[sexo]}`,
      `Error de ${n} ${n === 1 ? 'semana comprobada' : 'semanas comprobadas'}${n < 4 ? ': muy pocas para ordenar con seguridad' : ''}; menor es mejor`);
  }
  if (tipo === 'calibracion' || tipo === 'volumen_error') {
    const filas = estados(v, sexo).filter((e) => e.oos.semanas);
    if (!filas.length) return null;
    const cal = tipo === 'calibracion';
    const puntos = filas.map((e) => (cal ? { x: e.oos.pronostico_total, y: e.oos.observado_total, nombre: e.nombre } : { x: e.oos.observado_total, y: e.oos.smape, nombre: e.nombre }));
    const datasets = [{ label: 'Estados', data: puntos, backgroundColor: colorDe(v) + 'AA', borderColor: colorDe(v), pointRadius: 5, pointHoverRadius: 8 }];
    const lim = Math.max(...puntos.map((p) => Math.max(p.x, p.y))) * 1.05;
    if (cal) datasets.push({ label: 'Pronóstico perfecto', type: 'line', data: [{ x: 0, y: 0 }, { x: lim, y: lim }], borderColor: '#8a9690', borderDash: [6, 6], borderWidth: 1.5, pointRadius: 0, showLine: true, fill: false });
    const enc = cal ? `calibración por estado (${oos})` : `volumen observado frente a sMAPE (${oos})`;
    return {
      type: 'scatter', title: `${et(v)}: ${enc}`, datasets,
      options: { plugins: titulo([`${et(v)}: ${enc}`, SEXO_NOMBRE[sexo]]), scales: cal
        ? { x: { title: { display: true, text: 'Pronosticado (suma)' }, min: 0, max: lim }, y: { title: { display: true, text: 'Observado (suma)' }, min: 0, max: lim } }
        : { x: { title: { display: true, text: 'Casos observados' } }, y: { title: { display: true, text: 'sMAPE %' }, min: 0 } } },
    };
  }
  if (tipo === 'acumulado') {
    // Mesa de gráficas: «acumulado de 2026» dibujaba el acumulado del pronóstico hasta 2027 y el observado quedaba invisible.
    // Ahora: el año pedido (o el del último dato), observado acumulado desde el 1 de enero hasta el último dato (sólido) y su
    // continuación con el pronóstico hasta fin de ese año (guiones). Décimas enteras para no arrastrar error de coma flotante.
    const ultimo = x.observado.at(-1)?.[0];
    const anioQ = (String(qn).match(/\b(202[3-9])\b/) || [])[1];
    // Sin año en la pregunta, el texto da el acumulado del pronóstico desde el origen: la gráfica dice lo mismo.
    if (!anioQ) {
      const obs = new Map(x.observado);
      let a0 = 0; let b0 = 0;
      const labels0 = x.pronostico.map(([d]) => d);
      const pron0 = x.pronostico.map(([, y]) => Math.round((a0 += Math.round(y * 10)) / 10));
      const real0 = labels0.map((d) => (obs.has(d) ? Math.round((b0 += obs.get(d))) : null));
      const nObs = real0.filter((y) => y != null).length;
      const color0 = colorDe(v);
      return {
        type: 'line', title: `${et(v)} · ${lugarDe(x)} · ${x.sexo_nombre}: acumulado desde el origen`, labels: labels0,
        corte: nObs ? labels0[real0.map((y) => y != null).lastIndexOf(true)] : null,
        datasets: [
          ...(nObs ? [{ label: 'Observado acumulado', data: real0, borderColor: color0, borderWidth: 2, pointRadius: nObs < 4 ? 4 : 0, tension: 0, spanGaps: false }] : []),
          { label: esControlV(v) ? 'Control estacional acumulado (no validado)' : 'Pronóstico acumulado', data: pron0, borderColor: esControlV(v) ? GRIS_CONTROL : color0, borderDash: [7, 5], borderWidth: 2, pointRadius: 0, tension: 0 },
        ],
        options: { plugins: titulo([`${et(v)} · ${lugarDe(x)} · ${x.sexo_nombre}`, `Acumulado de ${v.horizon_weeks} semanas desde ${labels0[0]}`, notaPron(v)]),
          scales: { y: { beginAtZero: true, title: { display: true, text: 'Casos acumulados' } } } },
      };
    }
    const anio = anioQ;
    const obsAnio = x.observado.filter(([d]) => d.startsWith(anio));
    const pronResto = x.pronostico.filter(([d]) => d.startsWith(anio) && (!ultimo || d > ultimo));
    if (!obsAnio.length && !pronResto.length) return null;
    const labels = [...obsAnio.map(([d]) => d), ...pronResto.map(([d]) => d)];
    let a = 0;
    const real = obsAnio.map(([, y]) => Math.round((a += Math.round(y * 10)) / 10));
    const cont = [...new Array(Math.max(obsAnio.length - 1, 0)).fill(null), ...(obsAnio.length ? [real.at(-1)] : []),
      ...pronResto.map(([, y]) => Math.round((a += Math.round(y * 10)) / 10))];
    const color = colorDe(v);
    return {
      type: 'line', title: `${et(v)} · ${lugarDe(x)} · ${x.sexo_nombre}: casos acumulados en ${anio}`, labels,
      corte: obsAnio.length ? obsAnio.at(-1)[0] : null,
      datasets: [
        { label: `Observado acumulado en ${anio}`, data: [...real, ...pronResto.map(() => null)], borderColor: color, borderWidth: 2, pointRadius: 0, tension: 0, spanGaps: false },
        ...(pronResto.length ? [{ label: `${esControlV(v) ? 'Con el control estacional' : 'Con el pronóstico'} hasta fin de año`, data: cont, borderColor: esControlV(v) ? GRIS_CONTROL : color, borderDash: [7, 5], borderWidth: 2, pointRadius: 0, tension: 0 }] : []),
      ],
      options: { plugins: titulo([`${et(v)} · ${lugarDe(x)} · ${x.sexo_nombre}`, `Casos acumulados en ${anio}: ${real.at(-1)?.toLocaleString('es-MX') ?? 0} observados${pronResto.length ? ` y unos ${(cont.at(-1) - (real.at(-1) || 0)).toLocaleString('es-MX')} más esperados hasta fin de año` : ''}`, notaPron(v)]),
        scales: { y: { beginAtZero: true, title: { display: true, text: 'Casos acumulados' } } } },
    };
  }
  if (tipo === 'sexo') {
    const base = x.nivel === 'nacional' ? 'nacional|mx' : `estado|${x.id}`;
    const charts = ['hombres', 'mujeres'].map((sx, i) => {
      const s = v.series[`${base}|${sx}`];
      const { labels, datasets } = lineaObsPron(v, s, '2025-01-01', '9999', PALETA[i]);
      datasets.forEach((d) => { d.label = `${s.sexo_nombre}: ${d.label[0].toLowerCase()}${d.label.slice(1)}`; });
      return { labels, datasets };
    });
    return {
      type: 'line', title: `${et(v)} · ${lugarDe(x)}: hombres y mujeres`, labels: charts[0].labels,
      datasets: [...charts[0].datasets, ...charts[1].datasets],
      corte: x.observado.at(-1)?.[0] || null,
      options: { plugins: titulo([`${et(v)} · ${lugarDe(x)}`, 'Hombres y mujeres: línea continua observado, guiones ' + (esControlV(v) ? 'control estacional (no validado)' : 'pronóstico'), notaPron(v)]), scales: EJE_Y_SEMANAL },
    };
  }
  if (tipo === 'motores') {
    const cuenta = Object.entries(v.engines).sort((p, q) => q[1] - p[1]);
    return {
      type: 'doughnut', title: `${et(v)}: motores de las ${v.models} series modeladas`,
      labels: cuenta.map(([m]) => MOTOR_NOMBRE[m] || m),
      datasets: [{ label: 'Series', data: cuenta.map(([, n]) => n), backgroundColor: PALETA, borderWidth: 0 }],
      options: { plugins: titulo([`${et(v)}: motores de las ${v.models} series modeladas`, 'Estado × sexo; el resto se obtiene sumando']) },
    };
  }
  if (tipo === 'comparador') {
    let nombres = opciones.estados || estadosEnConsulta(v, qn);
    if (nombres.length < 2) nombres = estados(v, 'general').sort((a, b) => b.pronostico_52_total - a.pronostico_52_total).slice(0, 5).map((e) => e.nombre);
    const series = nombres.slice(0, 6).map((n) => estados(v, sexo).find((e) => e.nombre === n)).filter(Boolean);
    const labels = [...new Set(series.flatMap((s) => [...s.observado.map(([d]) => d), ...s.pronostico.map(([d]) => d)]))].filter((d) => d >= '2025-01-01').sort();
    const datasets = series.flatMap((s, i) => {
      const o = new Map(s.observado); const p = new Map(s.pronostico); const c = PALETA[i % PALETA.length];
      const nombre = s.nombre === 'México' ? 'Estado de México' : s.nombre;
      return [
        { label: nombre, data: labels.map((d) => o.get(d) ?? null), borderColor: c, borderWidth: 2, pointRadius: 0, tension: 0, spanGaps: false },
        { label: `${nombre} (${esControlV(v) ? 'control' : 'pronóstico'})`, data: labels.map((d) => p.get(d) ?? null), borderColor: c, borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, tension: 0, spanGaps: false },
      ];
    });
    return {
      type: 'line', title: `${et(v)}: comparación de estados, ${SEXO_NOMBRE[sexo]}`, labels, datasets,
      corte: series[0]?.observado.at(-1)?.[0] || null,
      options: { plugins: titulo([`${et(v)}: ${series.map((s) => (s.nombre === 'México' ? 'Estado de México' : s.nombre)).join(', ')}`, `${SEXO_NOMBRE[sexo]} · línea continua observado, guiones ${esControlV(v) ? 'control estacional (no validado)' : 'pronóstico'}`]), scales: EJE_Y_SEMANAL },
    };
  }
  return null;
}
