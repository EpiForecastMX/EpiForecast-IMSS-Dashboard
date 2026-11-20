/**
 * Radar del boletín en EPI: cifras notificadas de la foto vigente para los padecimientos que la
 * plataforma NO modela (no modelables, por incorporar, rechazados o agregados).
 *
 * La foto es la misma que lee `boletin.html` (`assets/boletin/actual.json` → `data.json`), así que
 * cada boletín nuevo llega a EPI sin tocar este archivo. Nunca da un pronóstico: repite las cifras
 * impresas del cuadro, con su semana de corte, y remite al radar. Los padecimientos publicados
 * siguen en sus handlers y los temas sensibles (autolesiones, ideación suicida, violencias) en la
 * respuesta de crisis, que no da cifras.
 */
import { summarizeCoverage, coberturaPanorama } from '../../assets/boletin/coverage.mjs?v=3';
import { ESTADO_NO_MODELABLE, GRUPOS_NO_MODELABLES, codigoEnConsulta, grupoNoModelable } from '../../assets/boletin/no_modelables.mjs?v=2';
import { GUION, esMarcador, guionNoPublicado, suma } from '../../assets/boletin/celdas.mjs?v=1';
import { referenciaExploratoria } from '../../assets/boletin/pronostico.mjs?v=10';

// Opción «Pronóstico» del radar (alta_b44): se menciona sin cifras y con el método real de cada categoría, leído de
// pronostico_exploratorio.json de la foto (estacional, nivel reciente o nivel derivado de las notas).
const referencia = (e, radar) => referenciaExploratoria(radar?.exploratorio?.[e.id] ?? null, '[Radar del boletín](../boletin.html)');

const SENSIBLE = /suicid|autolesion|autoinfligid|self harm|ideacion|violencia|arma de fuego|abuso sexual|maltrato/;

/** Primeras palabras que no identifican a un padecimiento (o que son de una familia ya modelada). */
const GENERICAS = new Set([
  'tumor', 'tumores', 'cancer', 'linfoma', 'leucemia', 'enfermedad', 'enfermedades', 'infeccion',
  'infecciones', 'otras', 'otros', 'sindrome', 'intoxicacion', 'mordedura', 'mordeduras', 'picadura',
  'lesion', 'envenenamiento', 'fiebre', 'historia', 'eventos', 'efectos', 'contacto', 'exposicion',
  'accidente', 'peaton', 'herida', 'edema', 'deplecion', 'paralisis', 'diabetes', 'hipertension',
  'dengue', 'neumonias', 'obesidad', 'anorexia', 'depresion', 'asma', 'gingivitis', 'ulceras',
  'sifilis', 'casos', 'boletin',
]);

/** Nombres coloquiales → patrón sobre el nombre normalizado de la categoría. */
const ALIAS = [
  [/\b(covid|coronavirus|sars cov 2)\b/, /^covid 19$/],
  [/\b(vih|sida|hiv|aids)\b/, /inmunodeficiencia humana/],
  [/\bmalaria\b/, /^paludismo/],
  [/\bhepatitis (tipo |virica |viral )?a\b/, /^hepatitis virica a$/],
  [/\bhepatitis (tipo |virica |viral )?b\b/, /^hepatitis virica b$/],
  [/\bhepatitis (tipo |virica |viral )?c\b/, /^hepatitis virica c$/],
  [/\bhepatitis\b/, /hepatitis/],
  [/\btos ?ferina\b/, /^tos ferina$/],
  [/\bchagas\b/, /chagas/],
  [/\bzika\b/, /zika/],
  [/\bchikungunya\b/, /chikungunya/],
  [/\b(vph|papiloma)\b/, /papiloma/],
  [/\brotavirus\b/, /rotavirus/],
  [/\btifoidea\b/, /^fiebre tifoidea$/],
  [/\bparatifoidea\b/, /^fiebre paratifoidea$/],
  [/\btifo\b/, /^tifo /],
  [/\bgonorrea\b/, /gonococica/],
  [/\bherpes\b/, /^herpes/],
  [/\b(mpox|viruela simica|viruela del mono|viruela de los monos)\b/, /viruela simica/],
  [/\balacran\b/, /alacran/],
  [/\bmeningitis\b/, /^meningitis/],
  [/\bcirrosis\b/, /cirrosis/],
  [/\bchancro\b/, /chancro/],
  [/\bclamidia\b/, /clamidias/],
  [/\besavi\b/, /esavi/],
  [/\bdeshidratacion\b/, /deshidratacion/],
  [/\bsarna\b/, /^escabiosis$/],
  [/\bpolio\b/, /^poliomielitis$/],
  [/\bebola\b/, /ebola/],
  [/\bmordeduras? (de|por) perros?\b/, /^mordeduras por perro$/],
  [/\baccidentes? (de|en) (transito|transporte|vehiculos?|carretera)\b|\bchoques? (de|vehicular)/, /accidente de transporte|^peaton lesionado/],
  [/\bintoxicacion (aguda )?(por|de) alcohol\b|\bintoxicacion alcoholica\b|\bintoxicacion etilica\b/, /^intoxicacion aguda por alcohol$/],
];

function normaliza(t) {
  return String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Índice compacto de la foto vigente; null si los archivos no son los esperados. */
export function compactaRadar(actual, data, exploratorio = null) {
  if (actual?.schema !== 'boletin_actual.v1' || !Array.isArray(data?.diseases) || !data.meta) return null;
  return {
    exploratorio: exploratorio?.categorias ?? null,
    meta: data.meta,
    carpeta: actual.carpeta,
    cobertura: summarizeCoverage(data.diseases),
    // Opción «Pronóstico» del radar: publicado y exploratorio no validado por separado (sólo conteos).
    pronostico: coberturaPanorama(data.diseases, exploratorio?.schema === 'radar_pronostico_exploratorio.v3' ? exploratorio : null),
    diseases: data.diseases.map((e) => ({ ...e, _n: normaliza(e.name) })),
  };
}

/** Carga la foto vigente del radar (mismo origen que boletin.html). */
export async function cargaRadar(base = '../') {
  const ra = await fetch(`${base}assets/boletin/actual.json`);
  if (!ra.ok) return null;
  const actual = await ra.json();
  if (actual?.schema !== 'boletin_actual.v1' || !/^assets\/boletin\/[0-9]{4}-w[0-9]{2}(-r[0-9]+)?$/.test(actual.carpeta ?? '')) return null;
  const rd = await fetch(`${base}${actual.carpeta}/data.json`);
  if (!rd.ok) return null;
  let expl = null;
  try {
    const rx = await fetch(`${base}${actual.carpeta}/pronostico_exploratorio.json`);
    if (rx.ok) expl = await rx.json();
  } catch { expl = null; }
  return compactaRadar(actual, await rd.json(), expl);
}

/** ¿El nombre de `e` aparece en `qq` también fuera de los nombres más largos de `otras` que lo contienen? */
function fueraDeNombresMayores(qq, e, otras) {
  let resto = qq;
  for (const o of otras) if (o !== e && o._n.length > e._n.length && o._n.includes(e._n)) resto = resto.split(` ${o._n} `).join('  ');
  return resto.includes(` ${e._n} `);
}

/** Categorías no modeladas que nombra la consulta (ya normalizada). Vacío si no hay o es sensible. */
export function buscaEnRadar(q, radar) {
  if (!radar || SENSIBLE.test(q)) return [];
  const qq = ` ${normaliza(q)} `;
  const candidatas = radar.diseases.filter((e) => !e.platform_id && !SENSIBLE.test(e._n));
  for (const [re, nombre] of ALIAS) {
    if (re.test(qq)) {
      const r = candidatas.filter((e) => nombre.test(e._n));
      if (r.length) return r;
    }
  }
  const completas = candidatas.filter((e) => e._n.length > 3 && qq.includes(` ${e._n} `));
  // «síndrome de rubéola congénita» nombra entera a esa categoría; «rubéola» sólo cuenta si también aparece fuera de los
  // nombres más largos que la contienen («casos de rubéola y síndrome de rubéola congénita» pide las dos).
  if (completas.length) return completas.filter((e) => fueraDeNombresMayores(qq, e, completas));
  const porCodigo = candidatas.filter((e) => e.status === ESTADO_NO_MODELABLE && codigoEnConsulta(e.code, q));
  if (porCodigo.length) return porCodigo;
  const palabras = new Set(qq.trim().split(' ').filter((w) => w.length >= 5 && !GENERICAS.has(w)));
  return candidatas.filter((e) => palabras.has(e._n.split(' ')[0]));
}

/** Categorías no modeladas cuyo nombre completo aparece en la consulta (nunca las sensibles). */
export function nombreCompletoEnRadar(q, radar) {
  if (!radar || SENSIBLE.test(q)) return [];
  const qq = ` ${normaliza(q)} `;
  return radar.diseases.filter((e) => !e.platform_id && !SENSIBLE.test(e._n) &&
    e._n.split(' ').length >= 2 && qq.includes(` ${e._n} `));
}

const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString('es-MX') : 'sin dato');

const ROTULO_COLUMNA = {
  'Sem.': 'Casos de la semana',
  H: 'Acumulado 2026, hombres',
  M: 'Acumulado 2026, mujeres',
  'Acum. 2026': 'Acumulado 2026',
  'Acum. 2025': 'Acumulado comparable 2025',
  'Mediana 2021–2025': 'Mediana semanal 2021–2025',
  'Sem. 2025': 'Semana comparable 2025',
};

/** «En el boletín…» tras dos puntos: minúscula inicial (no toca siglas ni nombres propios con mayúscula interna). */
const minusculaInicial = (t) => (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);

function estadoPlataforma(e, radar) {
  if (e.status === 'Rechazada') {
    return 'Se analizó y se **rechazó** en la prueba de 2025: no hay pronóstico publicado. Su evidencia está en [Analizados y rechazados](../rechazados.html). ' + referencia(e, radar);
  }
  if (e.status === 'Agregado') return 'Es un **agregado** del boletín que suma varias categorías; no se modela.';
  const g = grupoNoModelable(e);
  if (g) {
    return `Estado en la plataforma: **no modelable** (${GRUPOS_NO_MODELABLES[g].etiqueta.toLowerCase()}). Motivo medido: ${minusculaInicial(e.reason)} ` +
      'No hay modelo validado, pronóstico publicado ni control estacional. El motivo y las cifras de todas las categorías sin modelo validado están en ' +
      '[Categorías sin modelo validado](../no_modelables.html). ' + referencia(e, radar);
  }
  return 'Estado en la plataforma: **por incorporar**. No hay modelo ni pronóstico.';
}

function filaEstado(e, estado) {
  const n = normaliza(estado);
  return (e.states || []).find((s) => normaliza(s.state) === n) || null;
}

/**
 * Una celda tal como la imprime el boletín: cifra, guion o símbolo. El guion nunca se escribe
 * como 0: bajo la simbología es «no se presentaron casos»; en una categoría cuya propia fuente
 * lo contradice (guion.semantica === 'no_publicado') es una cifra no publicada.
 */
function celda(v, e, anio) {
  if (v == null) return 'sin dato';
  if (!esMarcador(v)) return fmt(v);
  if (v === GUION) return guionNoPublicado(e.guion, anio) ? '– (cifra no publicada en este cuadro)' : '– (sin casos)';
  return v;
}
const hayGuion = (vals) => vals.some((v) => v === GUION);

/** Nota que explica los guiones mostrados, campo por campo; sin guiones, ninguna. */
function notaGuion(e, radar, vals) {
  if (!hayGuion(vals)) return null;
  if (guionNoPublicado(e.guion, radar.meta.year)) {
    const ev = (e.guion.evidencia || [])[0];
    return `${e.guion.nota}${ev ? ` Fuente: ${ev.archivo}, p. ${ev.pagina}.` : ''}`;
  }
  const s = radar.meta.symbols;
  const texto = s?.simbolos?.[GUION] || 'no se presentaron casos';
  return `«–» es el guion que imprime el boletín; su simbología${s?.paginas?.length ? ` (p. ${s.paginas.join(' y ')})` : ''} lo define como «${texto}». No es un cero escrito por EPI.`;
}

function acumuladoEstado(e, fila, anio) {
  const cols = e.columns.map((c, k) => [c, fila.values[k]])
    .filter(([c]) => c === 'H' || c === 'M' || c === `Acum. ${anio}` || c.includes(' estadio '));
  return cols.length ? suma(cols.map(([, v]) => v), e.guion, anio) : null;
}

function etiquetaFechaBoletin(m) {
  return m?.publication_date_basis === 'first_verified_availability'
    ? `fecha de referencia / primera disponibilidad comprobada: ${m.publication}`
    : `publicado el ${m.publication}`;
}

/** Respuesta en markdown para las categorías encontradas; `estado` es el nombre canónico o null. */
export function respuestaRadar(encontradas, radar, estado) {
  const m = radar.meta;
  const cab = `Boletín Epidemiológico ${m.week} de ${m.year}, ${etiquetaFechaBoletin(m)}`;
  const pie = `\nCurva semanal desde 2013 y las 32 entidades en el [Radar del boletín](../boletin.html). ` +
    'Son casos notificados tal como los imprime el boletín, sin modelo validado ni pronóstico publicado de EpiForecast-MX.';
  if (encontradas.length === 1) {
    const e = encontradas[0];
    const lines = [`**${e.name} (${e.code})** · ${cab}\n`,
      `EpiForecast-MX **no modela** este padecimiento. ${estadoPlataforma(e, radar)}\n`,
      `**Nacional**, hasta la semana ${e.observed_week} de ${m.year}:`,
      `- Casos de la semana: **${celda(e.weekly, e, m.year)}**`,
      `- Acumulado ${m.year}: **${celda(e.cumulative, e, m.year)}**`,
      `- Acumulado comparable ${m.year - 1}: **${celda(e.previous, e, m.year)}**`];
    const mostrados = [e.weekly, e.cumulative, e.previous];
    if (estado && estado !== 'Nacional') {
      const fila = filaEstado(e, estado);
      if (!(e.states || []).length) {
        lines.push(`\nEl boletín imprime esta categoría solo en el resumen nacional; no hay cifra de ${estado}.`);
      } else if (!fila) {
        lines.push(`\n${estado} no aparece en el cuadro de esta categoría; no se imputan ceros.`);
      } else {
        lines.push(`\n**${fila.state}** (cifras originales del cuadro):`);
        e.columns.forEach((c, k) => lines.push(`- ${ROTULO_COLUMNA[c] || c}: **${celda(fila.values[k], e, m.year)}**`));
        mostrados.push(...fila.values);
      }
    }
    const nota = notaGuion(e, radar, mostrados);
    if (nota) lines.push(`\n${nota}`);
    lines.push(pie);
    return lines.join('\n');
  }
  const conEstado = estado && estado !== 'Nacional';
  const lines = [`**${encontradas.length} categorías del boletín** · ${cab}\n`,
    'EpiForecast-MX **no modela** estas categorías; no hay pronóstico.\n',
    `| Categoría | Código | Semana del cuadro | Casos de la semana | Acumulado ${m.year} | Acumulado comparable ${m.year - 1} |${conEstado ? ` ${estado}: semana / acumulado |` : ''}`,
    `|---|---|---|---|---|---|${conEstado ? '---|' : ''}`];
  const notas = new Set();
  for (const e of encontradas.slice(0, 8)) {
    let extra = '';
    const mostrados = [e.weekly, e.cumulative, e.previous];
    if (conEstado) {
      const fila = filaEstado(e, estado);
      const acum = fila ? acumuladoEstado(e, fila, m.year) : null;
      extra = fila ? ` ${celda(fila.values[0], e, m.year)} / ${celda(acum, e, m.year)} |` : ' sin fila |';
      if (fila) mostrados.push(fila.values[0], acum);
    }
    lines.push(`| ${e.name}${e.status === 'Rechazada' ? ' (rechazada)' : ''} | ${e.code} | ${e.observed_week} | ${celda(e.weekly, e, m.year)} | ${celda(e.cumulative, e, m.year)} | ${celda(e.previous, e, m.year)} |${extra}`);
    const nota = notaGuion(e, radar, mostrados);
    if (nota) notas.add(nota);
  }
  for (const nota of notas) lines.push(`\n${nota}`);
  if (encontradas.some((e) => e.status === 'Rechazada')) lines.push('\nLa rechazada se analizó en la prueba de 2025; su evidencia está en [Analizados y rechazados](../rechazados.html).');
  const nm = encontradas.slice(0, 8).filter((e) => grupoNoModelable(e));
  if (nm.length) {
    lines.push(`\nNo modelables con el método actual: ${nm.map((e) => `${e.name} (${GRUPOS_NO_MODELABLES[grupoNoModelable(e)].etiqueta.toLowerCase()})`).join('; ')}. ` +
      'El motivo medido de cada una está en [Categorías sin modelo validado](../no_modelables.html).');
  }
  lines.push(pie);
  return lines.join('\n');
}

/** Línea de cobertura de pronóstico: publicado y exploratorio no validado, sólo con su conteo. */
function lineaPronostico(p, c) {
  if (p?.exploratorio) {
    const sin = p.sin_pronostico ? `; ${fmt(p.sin_pronostico)} siguen sin pronóstico` : '';
    return `- Categorías con pronóstico: **${fmt(p.con_pronostico)} de ${fmt(p.total)}**: ${fmt(p.publicado)} con pronóstico publicado y ` +
      `${fmt(p.exploratorio)} con pronóstico exploratorio, no validado, que no es un pronóstico de EpiForecast-MX${sin}.`;
  }
  return `- Categorías sin pronóstico publicado: **${fmt(c.uncovered)}**: sus cifras notificadas se consultan sin modelo validado.`;
}

/** Resumen de cobertura: cuántas categorías vigila el boletín y cuántas publica la plataforma. */
export function resumenRadar(radar) {
  const m = radar.meta; const c = radar.cobertura;
  return [
    `**Radar del Boletín Epidemiológico ${m.week} de ${m.year}** (${etiquetaFechaBoletin(m)})\n`,
    `- Categorías de vigilancia: **${fmt(m.categories)}** (enfermedades, síndromes y eventos); ${fmt(m.territorial_blocks)} bloques traen las 32 entidades y el resto solo el resumen nacional.`,
    `- Padecimientos publicados en EpiForecast-MX: **${fmt(c.published)}**, ${fmt(c.controls)} de ellos con el control estacional.`,
    lineaPronostico(radar.pronostico, c),
    ...(c.unmodelable ? [`- De las ${fmt(c.uncovered)} sin modelo validado, **${fmt(c.unmodelable)}** no son modelables con el método actual; el motivo medido de cada una está en [Categorías sin modelo validado](../no_modelables.html).`] : []),
    '\nPregúntame por cualquiera («tuberculosis en Jalisco», «casos de varicela») o recorre las curvas desde 2013 en el [Radar del boletín](../boletin.html).',
  ].join('\n');
}
