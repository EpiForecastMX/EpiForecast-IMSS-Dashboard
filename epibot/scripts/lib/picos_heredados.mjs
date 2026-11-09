/**
 * Picos heredados de la fuente (tercera auditoría, 9-nov-2026, A3).
 *
 * Un boletín puede imprimir, para una entidad, una semana aislada muy por encima de lo habitual
 * (Morelos, linfoma de Hodgkin, 2025-W43: 213 casos frente a 7 y 2 en las semanas vecinas). Los
 * motores estacionales lo arrastran (el ingenuo estacional repite lo observado 52 semanas antes; las
 * medias estacionales promedian la misma semana epidemiológica de años anteriores), así que el pronóstico
 * publicado hereda ese pico y el total nacional de esa semana lo arrastra. El dato es fiel a la fuente
 * y su causa no está establecida: no se corrige ni se califica de errata, se contextualiza.
 *
 * La detección sale sólo de la vista publicada (observado y pronóstico por entidad), así que vale
 * para cualquier release: la usan el corpus del RAG y la nota estática de cada página.
 */

const DIA = 864e5;
// Umbrales: una semana aislada (5 veces la mayor vecina), muy por encima de la mediana de la entidad
// (10 veces), con volumen suficiente (50 casos) y heredada por el pronóstico (5 veces la mediana).
export const UMBRALES = Object.freeze({ minimo: 50, vecesMediana: 10, vecesVecinas: 5, herencia: 5 });

const mediana = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0;
};
const inicioMmwr = (a) => {
  const d = new Date(Date.UTC(a, 0, 1));
  const dow = d.getUTCDay();
  return Date.UTC(a, 0, 1 + (dow <= 3 ? -dow : 7 - dow));
};
/** Semana MMWR de un `ds` de la vista (lunes; el periodo empieza el domingo anterior). */
export function semanaDe(ds) {
  const t = Date.parse(`${ds}T00:00:00Z`) - DIA;
  const a0 = new Date(t).getUTCFullYear();
  for (const a of [a0 + 1, a0, a0 - 1]) {
    if (inicioMmwr(a) <= t) return [a, Math.floor((t - inicioMmwr(a)) / (7 * DIA)) + 1];
  }
  throw new Error(`semana MMWR indeterminada para ${ds}`);
}
const masDias = (ds, k) => new Date(Date.parse(`${ds}T00:00:00Z`) + k * DIA).toISOString().slice(0, 10);
export const etiquetaSemana = ([a, s]) => `${a}-W${String(s).padStart(2, '0')}`;
const num = (n) => Number(n).toLocaleString('es-MX', { maximumFractionDigits: 1 });

/** Picos aislados del observado de cada entidad (serie general) que el pronóstico repite. */
export function picosHeredados(v) {
  const nac = v.series?.['nacional|mx|general'];
  if (!nac) return [];
  const pronNac = new Map(nac.pronostico);
  const medNac = mediana(nac.pronostico.map((x) => x[1]));
  const out = [];
  const estados = Object.values(v.series)
    .filter((s) => s.nivel === 'estado' && s.sexo === 'general')
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  for (const s of estados) {
    const obs = s.observado;
    const med = mediana(obs.map((x) => x[1]));
    const pron = new Map(s.pronostico);
    obs.forEach(([ds, y], i) => {
      const previa = obs[i - 1]?.[1] ?? 0;
      const siguiente = obs[i + 1]?.[1] ?? 0;
      const aislado =
        y >= UMBRALES.minimo &&
        y >= UMBRALES.vecesMediana * Math.max(med, 1) &&
        y >= UMBRALES.vecesVecinas * Math.max(previa, siguiente, 1);
      const dsPron = masDias(ds, 364);
      const heredado = pron.get(dsPron);
      if (!aislado || heredado === undefined || heredado < UMBRALES.herencia * Math.max(med, 1)) return;
      const nacional = pronNac.get(dsPron);
      // Motores de las series base de la entidad (por sexo, o la general si no hay desglose): la
      // explicación del arrastre depende del motor (cuarta auditoría, B3).
      const bases = Object.values(v.series).filter(
        (b) => b.nivel === 'estado' && b.id === s.id && b.motor !== 'portfolio',
      );
      out.push({
        estado: s.nombre,
        motores: [...new Set(bases.map((b) => b.motor))].sort(),
        semanaObservada: semanaDe(ds),
        observado: y,
        previa,
        siguiente,
        medianaEstado: med,
        semanaPronosticada: semanaDe(dsPron),
        pronosticado: heredado,
        nacional,
        participacion: nacional ? (100 * heredado) / nacional : null,
        medianaNacional: medNac,
        veces: medNac > 0 ? nacional / medNac : null,
      });
    });
  }
  return out;
}

const ANIOS = { 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco' };

/** Cómo arrastra el motor la semana observada hasta la pronosticada (cuarta auditoría, B3). */
export function arrastre(p) {
  const [aObs, sObs] = p.semanaObservada;
  const [, sPron] = p.semanaPronosticada;
  const m = p.motores || [];
  if (m.length === 1 && m[0] === 'seasonal_naive_lag52') {
    // El ingenuo estacional desplaza 52 semanas (364 días): tras un año MMWR de 53 semanas, el número
    // de semana baja uno (2025-W43 cae en 2026-W42).
    const corrido = sPron !== sObs
      ? ` (${aObs} tuvo 53 semanas epidemiológicas, por eso ${etiquetaSemana(p.semanaObservada)} cae en ` +
        `${etiquetaSemana(p.semanaPronosticada)})`
      : '';
    return `El motor de esa serie, el ingenuo estacional, repite lo observado 52 semanas antes${corrido}`;
  }
  const media = m.length === 1 && /^seasonal_(mean|median)_(\d)y$/.exec(m[0]);
  if (media) {
    const tipo = media[1] === 'mean' ? 'La media' : 'La mediana';
    const anios = ANIOS[media[2]] || media[2];
    return `${tipo} estacional de ${anios} años, el motor de esa serie, ` +
      `${media[1] === 'mean' ? 'promedia' : 'toma la mediana de'} la misma semana epidemiológica de años anteriores`;
  }
  return 'Los motores de esa serie repiten o promedian semanas de años anteriores';
}

/** Texto llano del pico, para el corpus y para la nota de la página. */
export function textoPico(p) {
  return (
    `En la semana epidemiológica ${etiquetaSemana(p.semanaObservada)} el boletín imprimió ` +
    `${num(p.observado)} casos de ${p.estado}, frente a ${num(p.previa)} y ${num(p.siguiente)} en las ` +
    `semanas vecinas (mediana semanal de la entidad: ${num(p.medianaEstado)}). ${arrastre(p)}, ` +
    `así que el pronóstico de ` +
    `${etiquetaSemana(p.semanaPronosticada)} trae ${num(p.pronosticado)} casos de ${p.estado}: ` +
    `${num(p.participacion)} % de los ${num(p.nacional)} nacionales de esa semana, ` +
    `${num(p.veces)} veces la mediana semanal del horizonte nacional (${num(p.medianaNacional)}). ` +
    `El valor es fiel a la fuente y su causa no está establecida; esa semana no debe leerse como un ` +
    `aumento esperado. El dato y el pronóstico se publican sin modificar.`
  );
}

export const idPico = (p) => `${p.estado}|${etiquetaSemana(p.semanaObservada)}`;

/** Párrafo estático de la página (una línea, idempotente por `data-pico`). */
export const htmlPico = (p) =>
  `<p class="pico-heredado" data-pico="${idPico(p)}"><strong>Un pico heredado de la fuente.</strong> ${textoPico(p)}</p>`;
