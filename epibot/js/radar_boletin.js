/**
 * Radar del boletín en EPI: cifras notificadas de la foto vigente para los padecimientos que la
 * plataforma NO modela (por incorporar, rechazados o agregados).
 *
 * La foto es la misma que lee `boletin.html` (`assets/boletin/actual.json` → `data.json`), así que
 * cada boletín nuevo llega a EPI sin tocar este archivo. Nunca da un pronóstico: repite las cifras
 * impresas del cuadro, con su semana de corte, y remite al radar. Los padecimientos publicados
 * siguen en sus handlers y los temas sensibles (autolesiones, ideación suicida, violencias) en la
 * respuesta de crisis, que no da cifras.
 */
import { summarizeCoverage } from '../../assets/boletin/coverage.mjs?v=1';

const SENSIBLE = /suicid|autolesion|autoinfligid|self harm|ideacion|violencia|arma de fuego|abuso sexual|maltrato/;

/** Primeras palabras que no identifican a un padecimiento (o que son de una familia ya modelada). */
const GENERICAS = new Set([
  'tumor', 'tumores', 'cancer', 'linfoma', 'leucemia', 'enfermedad', 'enfermedades', 'infeccion',
  'infecciones', 'otras', 'otros', 'sindrome', 'intoxicacion', 'mordedura', 'mordeduras', 'picadura',
  'lesion', 'envenenamiento', 'fiebre', 'historia', 'eventos', 'efectos', 'contacto', 'exposicion',
  'accidente', 'peaton', 'herida', 'edema', 'deplecion', 'paralisis', 'diabetes', 'hipertension',
  'dengue', 'neumonias', 'obesidad', 'anorexia', 'depresion', 'asma', 'gingivitis', 'ulceras',
  'casos', 'boletin',
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
export function compactaRadar(actual, data) {
  if (actual?.schema !== 'boletin_actual.v1' || !Array.isArray(data?.diseases) || !data.meta) return null;
  return {
    meta: data.meta,
    carpeta: actual.carpeta,
    cobertura: summarizeCoverage(data.diseases),
    diseases: data.diseases.map((e) => ({ ...e, _n: normaliza(e.name) })),
  };
}

/** Carga la foto vigente del radar (mismo origen que boletin.html). */
export async function cargaRadar(base = '../') {
  const ra = await fetch(`${base}assets/boletin/actual.json`);
  if (!ra.ok) return null;
  const actual = await ra.json();
  if (actual?.schema !== 'boletin_actual.v1' || !/^assets\/boletin\/[0-9]{4}-w[0-9]{2}$/.test(actual.carpeta ?? '')) return null;
  const rd = await fetch(`${base}${actual.carpeta}/data.json`);
  if (!rd.ok) return null;
  return compactaRadar(actual, await rd.json());
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
  if (completas.length) return completas;
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

function estadoPlataforma(e) {
  if (e.status === 'Rechazada') {
    return 'Se analizó y se **rechazó** en la prueba de 2025: no hay pronóstico publicado. Su evidencia está en [Analizados y rechazados](../rechazados.html).';
  }
  if (e.status === 'Agregado') return 'Es un **agregado** del boletín que suma varias categorías; no se modela.';
  return 'Estado en la plataforma: **por incorporar**. No hay modelo ni pronóstico.';
}

function filaEstado(e, estado) {
  const n = normaliza(estado);
  return (e.states || []).find((s) => normaliza(s.state) === n) || null;
}

/** Todas las columnas en cero: el cuadro puede imprimir guiones (vigilancia especial), no ausencia. */
function sinCifras(e) {
  return (e.totals || []).every((v) => v === 0);
}
const AVISO_SIN_CIFRAS = 'El cuadro imprime **guiones o ceros** en todas sus columnas, también en 2025. ' +
  'No se lee como ausencia de casos: algunas categorías se vigilan en un sistema especial y sus cifras no aparecen en este cuadro.';

function acumuladoEstado(e, fila) {
  const i26 = e.columns.indexOf('Acum. 2026');
  if (i26 >= 0) return fila.values[i26];
  const iH = e.columns.indexOf('H'); const iM = e.columns.indexOf('M');
  return iH >= 0 && iM >= 0 ? fila.values[iH] + fila.values[iM] : null;
}

/** Respuesta en markdown para las categorías encontradas; `estado` es el nombre canónico o null. */
export function respuestaRadar(encontradas, radar, estado) {
  const m = radar.meta;
  const cab = `Boletín Epidemiológico ${m.week} de ${m.year}, publicado el ${m.publication}`;
  const pie = `\nCurva semanal desde 2013 y las 32 entidades en el [Radar del boletín](../boletin.html). ` +
    'Son casos notificados tal como los imprime el boletín, sin modelo ni pronóstico de EpiForecast-MX.';
  if (encontradas.length === 1) {
    const e = encontradas[0];
    const lines = [`**${e.name} (${e.code})** · ${cab}\n`,
      `EpiForecast-MX **no modela** este padecimiento. ${estadoPlataforma(e)}\n`,
      `**Nacional**, hasta la semana ${e.observed_week} de ${m.year}:`,
      `- Casos de la semana: **${fmt(e.weekly)}**`,
      `- Acumulado ${m.year}: **${fmt(e.cumulative)}**`,
      `- Acumulado comparable ${m.year - 1}: **${fmt(e.previous)}**`];
    if (sinCifras(e)) lines.push(`\n${AVISO_SIN_CIFRAS}`);
    if (estado && estado !== 'Nacional') {
      const fila = filaEstado(e, estado);
      if (!(e.states || []).length) {
        lines.push(`\nEl boletín imprime esta categoría solo en el resumen nacional; no hay cifra de ${estado}.`);
      } else if (!fila) {
        lines.push(`\n${estado} no aparece en el cuadro de esta categoría; no se imputan ceros.`);
      } else {
        lines.push(`\n**${fila.state}** (cifras originales del cuadro):`);
        e.columns.forEach((c, k) => lines.push(`- ${ROTULO_COLUMNA[c] || c}: **${fmt(fila.values[k])}**`));
      }
    }
    lines.push(pie);
    return lines.join('\n');
  }
  const conEstado = estado && estado !== 'Nacional';
  const lines = [`**${encontradas.length} categorías del boletín** · ${cab}\n`,
    'EpiForecast-MX **no modela** estas categorías; no hay pronóstico.\n',
    `| Categoría | Código | Semana del cuadro | Casos de la semana | Acumulado ${m.year} | Acumulado comparable ${m.year - 1} |${conEstado ? ` ${estado}: semana / acumulado |` : ''}`,
    `|---|---|---|---|---|---|${conEstado ? '---|' : ''}`];
  for (const e of encontradas.slice(0, 8)) {
    let extra = '';
    if (conEstado) {
      const fila = filaEstado(e, estado);
      extra = fila ? ` ${fmt(fila.values[0])} / ${fmt(acumuladoEstado(e, fila))} |` : ' sin fila |';
    }
    lines.push(`| ${e.name}${e.status === 'Rechazada' ? ' (rechazada)' : ''} | ${e.code} | ${e.observed_week} | ${fmt(e.weekly)} | ${fmt(e.cumulative)} | ${fmt(e.previous)} |${extra}`);
  }
  if (encontradas.some(sinCifras)) lines.push(`\n${AVISO_SIN_CIFRAS}`);
  if (encontradas.some((e) => e.status === 'Rechazada')) lines.push('\nLa rechazada se analizó en la prueba de 2025; su evidencia está en [Analizados y rechazados](../rechazados.html).');
  lines.push(pie);
  return lines.join('\n');
}

/** Resumen de cobertura: cuántas categorías vigila el boletín y cuántas publica la plataforma. */
export function resumenRadar(radar) {
  const m = radar.meta; const c = radar.cobertura;
  return [
    `**Radar del Boletín Epidemiológico ${m.week} de ${m.year}** (publicado el ${m.publication})\n`,
    `- Categorías de vigilancia: **${fmt(m.categories)}** (enfermedades, síndromes y eventos); ${fmt(m.territorial_blocks)} bloques traen las 32 entidades y el resto solo el resumen nacional.`,
    `- Padecimientos publicados en EpiForecast-MX: **${fmt(c.published)}**, ${fmt(c.controls)} de ellos con el control estacional.`,
    `- Categorías sin cobertura: **${fmt(c.uncovered)}**: sus cifras notificadas se consultan sin modelo ni pronóstico.`,
    '\nPregúntame por cualquiera («tuberculosis en Jalisco», «casos de varicela») o recorre las curvas desde 2013 en el [Radar del boletín](../boletin.html).',
  ].join('\n');
}
