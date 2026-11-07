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
import { RELEASES, releaseDeId } from './release_config.js?v=6';

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
  portfolio: 'portafolio (suma de las series estatales)',
};

/** Orden de prioridad: lo más específico primero. */
const REGLAS = [
  ['timelapse', ['timelapse', 'mapa animado', 'animacion', 'animado']],
  ['semaforo', ['semaforo', 'nivel de riesgo', 'alerta epidemiolog']],
  ['pdf', ['reporte pdf', 'reporte ejecutivo', 'pdf', 'exportar', 'descargar']],
  ['banda', ['corredor', 'confianza', 'banda', 'intervalo', 'incertidumbre']],
  ['heatmap', ['heatmap', 'mapa de calor', 'error semanal', 'diferencias del seguimiento']],
  ['entidades', ['treemap', 'mapa de entidad', 'por entidad', 'panorama', 'casos por estado']],
  ['mapa', ['mapa', 'coropletico', 'geografico']],
  ['ranking', ['mejores y peores', 'ranking', 'top ', 'mejor', 'peor', 'precis', 'acierta', 'falla']],
  ['entidades', ['que estado', 'cual estado', 'cuales estados', 'mas casos', 'mayor numero', 'donde hay mas']],
  ['calibracion', ['calibracion', 'calibrado', 'real vs pronostico', 'observado vs pronostico']],
  ['volumen_error', ['volumen vs error', 'volumen y error', 'burbuja', 'scatter', 'dispersion', 'matriz']],
  ['acumulado', ['acumulad', 'cascada', 'waterfall', 'aporte']],
  ['sexo', ['apilad', 'stacked', 'composicion', 'por sexo', 'hombres y mujeres', 'hombres vs mujeres', 'mujeres y hombres', 'mujeres vs hombres']],
  ['motores', ['motor', 'arsenal', 'polar', 'rosa de']],
  ['comparador', ['comparador', 'comparar', 'compara ', 'comparacion de estados', 'comparacion entre', 'sparkline', 'mini grafic', ' vs ', ' contra ']],
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
export const noDisponible = (tipo, nombre) => NO_DISPONIBLE[tipo].replaceAll('Obesidad', nombre);

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
const PALETA = ['#F59E0B', '#5B8DEF', '#2DD4BF', '#F472B6', '#A78BFA', '#FF8F4F'];

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
const colorDe = (v) => releaseDeId(v.disease_id)?.color || v.color || PALETA[0];
const lugarDe = (x) => (x.nivel === 'nacional' ? 'Nacional' : x.nombre);
const semana = ([a, w]) => `${a}-W${String(w).padStart(2, '0')}`;

function titulo(lineas) {
  return { title: { display: true, text: lineas, font: { size: 13, weight: '700', family: 'Outfit' }, color: '#E7ECF5', align: 'start', padding: { bottom: 10, top: 4 } } };
}

function lineaObsPron(v, x, desde, hasta, color) {
  const obs = new Map(x.observado);
  const pron = new Map(x.pronostico);
  const labels = [...new Set([...obs.keys(), ...pron.keys()])].filter((d) => d >= desde && d <= hasta).sort();
  return {
    labels,
    datasets: [
      { label: 'Observado', data: labels.map((d) => obs.get(d) ?? null), borderColor: color, backgroundColor: color + '22', borderWidth: 2.5, pointRadius: 0, tension: 0.25, spanGaps: false, order: 1 },
      { label: `Pronóstico congelado (origen ${semana(v.origin)})`, data: labels.map((d) => pron.get(d) ?? null), borderColor: color + '99', borderDash: [8, 5], borderWidth: 2, pointRadius: 0, tension: 0.25, spanGaps: false, order: 2 },
    ],
  };
}

function lineal(v, x, desde, hasta, encabezado) {
  const color = colorDe(v);
  const { labels, datasets } = lineaObsPron(v, x, desde, hasta, color);
  return {
    type: 'line',
    title: `${et(v)} · ${lugarDe(x)} · ${x.sexo_nombre}: ${encabezado}`,
    labels,
    datasets,
    options: { plugins: titulo([`${et(v)} · ${lugarDe(x)} · ${x.sexo_nombre}`, encabezado, 'Pronóstico puntual, sin intervalos']) },
  };
}

function barrasEstados(v, filas, valor, etiqueta, encabezado, color) {
  return {
    type: 'bar',
    horizontal: true,
    title: `${et(v)}: ${encabezado}`,
    labels: filas.map((x) => x.nombre),
    datasets: [{ label: etiqueta, data: filas.map(valor), backgroundColor: filas.map((x) => (color ? color(x) : PALETA[0]) + 'CC'), borderColor: filas.map((x) => (color ? color(x) : PALETA[0])), borderWidth: 1, borderRadius: 4 }],
    options: { plugins: titulo([`${et(v)}: ${encabezado}`]) },
  };
}

const colorError = (s) => (s <= 20 ? '#5B8DEF' : s <= 40 ? '#2DD4BF' : '#F472B6');

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
  const oos = `fuera de muestra, ${semana([v.origin[0], v.origin[1] + 1])}–${semana(v.observation_cutoff)}`;
  if (!x) return null;

  if (tipo in NO_DISPONIBLE) return null;
  if (tipo === 'serie' || tipo === 'banda' || tipo === 'motor_serie') {
    return lineal(v, x, `${Math.max(v.origin[0] - 3, 2023)}-01-01`, '9999', `historia desde 2023 y ${v.horizon_weeks} semanas de pronóstico`);
  }
  if (tipo === 'seguimiento') {
    const ini = x.pronostico[0][0];
    const desde = new Date(Date.parse(ini) - 13 * 7 * 864e5).toISOString().slice(0, 10);
    const hasta = (x.pronostico.find(([d]) => d > v.observation_cutoff_ds) || x.pronostico.at(-1))[0];
    const fin = x.pronostico[Math.min(x.pronostico.findIndex(([d]) => d === hasta) + 7, x.pronostico.length - 1)][0];
    return lineal(v, x, desde, fin, `zoom semanal: observado frente al pronóstico desde ${x.pronostico[0][0]}`);
  }
  if (tipo === 'mapa') {
    const error = has(strip(qn), ['error', 'smape', 'precision', 'sesgo', 'desempeno']);
    if (error && !estados(v, sexo).some((e) => e.oos.smape != null)) return null;
    const stateData = {};
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
      title: error ? `${et(v)}, ${SEXO_NOMBRE[sexo]}: sMAPE ${oos}` : `${et(v)}, ${SEXO_NOMBRE[sexo]}: casos pronosticados en ${v.horizon_weeks} semanas`,
      lowColor: [30, 60, 50], highColor: error ? [244, 114, 182] : [245, 158, 11], metric: error ? 'sMAPE %' : 'casos' } };
  }
  if (tipo === 'entidades') {
    const filas = estados(v, sexo).sort((a, b) => b.pronostico_52_total - a.pronostico_52_total);
    return barrasEstados(v, filas, (e) => Math.round(e.pronostico_52_total), `Casos (${v.horizon_weeks} sem)`, `casos pronosticados por estado, ${SEXO_NOMBRE[sexo]}`);
  }
  if (tipo === 'ranking') {
    const filas = estados(v, sexo).filter((e) => e.oos.smape != null).sort((a, b) => a.oos.smape - b.oos.smape);
    if (!filas.length) return null;
    return barrasEstados(v, filas, (e) => e.oos.smape, 'sMAPE %', `sMAPE por estado (${oos}), ${SEXO_NOMBRE[sexo]}`, (e) => colorError(e.oos.smape));
  }
  if (tipo === 'calibracion' || tipo === 'volumen_error') {
    const filas = estados(v, sexo).filter((e) => e.oos.semanas);
    if (!filas.length) return null;
    const cal = tipo === 'calibracion';
    const puntos = filas.map((e) => (cal ? { x: e.oos.pronostico_total, y: e.oos.observado_total, nombre: e.nombre } : { x: e.oos.observado_total, y: e.oos.smape, nombre: e.nombre }));
    const datasets = [{ label: 'Estados', data: puntos, backgroundColor: colorDe(v) + 'AA', borderColor: colorDe(v), pointRadius: 5, pointHoverRadius: 8 }];
    const lim = Math.max(...puntos.map((p) => Math.max(p.x, p.y))) * 1.05;
    if (cal) datasets.push({ label: 'Pronóstico perfecto', type: 'line', data: [{ x: 0, y: 0 }, { x: lim, y: lim }], borderColor: 'rgba(226, 232, 245, 0.5)', borderDash: [6, 6], borderWidth: 1.5, pointRadius: 0, showLine: true, fill: false });
    const enc = cal ? `calibración por estado (${oos})` : `volumen observado frente a sMAPE (${oos})`;
    return {
      type: 'scatter', title: `${et(v)}: ${enc}`, datasets,
      options: { plugins: titulo([`${et(v)}: ${enc}`, SEXO_NOMBRE[sexo]]), scales: cal
        ? { x: { title: { display: true, text: 'Pronosticado (suma)' }, min: 0, max: lim }, y: { title: { display: true, text: 'Observado (suma)' }, min: 0, max: lim } }
        : { x: { title: { display: true, text: 'Casos observados' } }, y: { title: { display: true, text: 'sMAPE %' }, min: 0 } } },
    };
  }
  if (tipo === 'acumulado') {
    const obs = new Map(x.observado);
    // Los puntos vienen a un decimal: se acumulan en décimas enteras para que el último punto sea
    // exactamente el total publicado (pronostico_52_total), sin error de coma flotante.
    let a = 0; let b = 0;
    const labels = x.pronostico.map(([d]) => d);
    const pron = x.pronostico.map(([, y]) => Math.round((a += Math.round(y * 10)) / 10));
    const real = labels.map((d) => (obs.has(d) ? Math.round((b += obs.get(d))) : null));
    const color = colorDe(v);
    return {
      type: 'line', title: `${et(v)} · ${lugarDe(x)} · ${x.sexo_nombre}: acumulado desde el origen`, labels,
      datasets: [
        { label: 'Observado acumulado', data: real, borderColor: color, borderWidth: 2.5, pointRadius: 0, spanGaps: false },
        { label: 'Pronóstico acumulado', data: pron, borderColor: color + '99', borderDash: [8, 5], borderWidth: 2, pointRadius: 0 },
      ],
      options: { plugins: titulo([`${et(v)} · ${lugarDe(x)} · ${x.sexo_nombre}`, `Acumulado desde ${labels[0]}`]) },
    };
  }
  if (tipo === 'sexo') {
    const base = x.nivel === 'nacional' ? 'nacional|mx' : `estado|${x.id}`;
    const charts = ['hombres', 'mujeres'].map((sx, i) => {
      const s = v.series[`${base}|${sx}`];
      const { labels, datasets } = lineaObsPron(v, s, '2025-01-01', '9999', PALETA[i + 1]);
      datasets.forEach((d) => { d.label = `${s.sexo_nombre}: ${d.label[0].toLowerCase()}${d.label.slice(1)}`; });
      return { labels, datasets };
    });
    return {
      type: 'line', title: `${et(v)} · ${lugarDe(x)}: hombres y mujeres`, labels: charts[0].labels,
      datasets: [...charts[0].datasets, ...charts[1].datasets],
      options: { plugins: titulo([`${et(v)} · ${lugarDe(x)}`, 'Hombres y mujeres, observado y pronóstico congelado']) },
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
      return [
        { label: s.nombre, data: labels.map((d) => o.get(d) ?? null), borderColor: c, borderWidth: 2, pointRadius: 0, spanGaps: false },
        { label: `${s.nombre} (pronóstico)`, data: labels.map((d) => p.get(d) ?? null), borderColor: c + '99', borderDash: [6, 4], borderWidth: 1.5, pointRadius: 0, spanGaps: false },
      ];
    });
    return {
      type: 'line', title: `${et(v)}: comparación de estados, ${SEXO_NOMBRE[sexo]}`, labels, datasets,
      options: { plugins: titulo([`${et(v)}: ${series.map((s) => s.nombre).join(', ')}`, `${SEXO_NOMBRE[sexo]} · línea continua observado, punteada pronóstico`]) },
    };
  }
  return null;
}
