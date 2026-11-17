/**
 * vista_grounding.mjs — Respuestas estructuradas desde `publication/<id>/vista.json` y proveniencia
 * temporal en el contexto/snippets semánticos de rag.mjs, sin valores numéricos hardcodeados.
 */
import {
  CONSEJO_CLINICO,
  GENERICO_ESTATAL,
  detectarGeos,
  detectarSexo,
  normPal,
  resolverConsultaRag,
  semana,
  semanaSig,
} from './vista_turno.mjs';

export { resolverConsultaRag };

const MOTOR_ES = {
  ets_add_damped_log1p: 'ETS amortiguado (log)',
  prophet_count_log1p: 'Prophet en conteos (log)',
  prophet_rate_log1p: 'Prophet en tasa (log)',
  ridge_harmonic_log1p: 'Ridge armónico (log)',
  seasonal_naive_lag52: 'naive estacional (rezago de 52 semanas)',
  seasonal_mean_3y: 'media estacional de 3 años',
  seasonal_median_3y: 'mediana estacional de 3 años',
  seasonal_mean_5y: 'media estacional de 5 años',
  seasonal_median_5y: 'mediana estacional de 5 años',
  seasonal_mean_2y: 'media estacional de 2 años',
  portfolio: 'portafolio derivado por suma de las series base',
};

const AMBITO_CONTROL = {
  smape_bases: (sinSexo) => (sinSexo ? 'las series por estado' : 'las series por estado y sexo'),
  smape_all: () => 'el conjunto de las series publicadas',
  smape_nacional_general: () => 'el total nacional',
};

const ent = (n) => Math.round(Number(n || 0)).toLocaleString('en-US');
const uno = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const num = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const pct = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const lista = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}` : xs[0] || '');

function geoEtiqueta(s) {
  if (s.nivel === 'nacional') return 'el total nacional (México)';
  return s.nombre === 'México' ? 'Estado de México' : s.nombre;
}

function hallarSerie(v, geo, sx) {
  if (geo.nivel === 'nacional') return v.series[`nacional|mx|${sx}`] || null;
  return Object.values(v.series).find((s) => s.nivel === geo.nivel && s.nombre === geo.nombre && s.sexo === sx) || null;
}

function metaVista(r, v, pruebaAnio = null) {
  const wOr = semana(v.origin);
  const wIni = semana(semanaSig(v.origin, 1));
  const wFin = semana(semanaSig(v.origin, v.horizon_weeks));
  const nac = v.series['nacional|mx|general'];
  const wa = v.weeks_available ?? 0;
  const wr = v.weeks_required ?? 4;
  const anio = String(v.caida_al_control?.fold || '').replace(/^test_/, '') || pruebaAnio || '2025';
  const wOos = nac?.oos?.semanas
    ? (nac.oos.semanas === 1 ? wIni : `${wIni}–${semana(semanaSig(v.origin, nac.oos.semanas))}`)
    : null;
  const preEm = Boolean(r.cronologia && /antes de emitir/i.test(r.cronologia));
  const estCorto = v.caida_al_control
    ? `Control estacional no validado (portafolio rechazado en prueba única ${anio}; ${wa}/${wr} contador técnico)`
    : `Portafolio aceptado en ${anio} (${wa}/${wr} ${v.verdict})`;
  return { nombre: v.nombre_completo || r.etiqueta, wOr, wIni, wFin, nac, wa, wr, anio, wOos, preEm, estCorto };
}

function resumenMetodo(r, v, m, prueba, serieRef, sinSexo) {
  const caida = v.caida_al_control;
  if (caida) {
    const comp = Object.fromEntries((caida.comprobaciones || []).map((c) => [c.ambito, c]));
    const fallas = (caida.comprobaciones || []).filter((c) => !c.pasa)
      .map((c) => `${AMBITO_CONTROL[c.ambito](sinSexo)} (sMAPE ${uno(c.portafolio)} frente a ${uno(c.control)} del control)`);
    const errs = ['smape_bases', 'smape_all', 'smape_nacional_general'].filter((a) => comp[a])
      .map((a) => `${uno(comp[a].control)} en ${AMBITO_CONTROL[a](sinSexo)}`);
    const baseMotor = MOTOR_ES[caida.motor] || caida.motor;
    const comoSerie = serieRef?.motor === 'portfolio'
      ? `la serie se obtiene por suma de las series base (${sinSexo ? 'por entidad' : 'por entidad y sexo'}), cada una calculada con **${baseMotor}** (repite los casos de 52 semanas antes)`
      : `calculado con **${MOTOR_ES[serieRef?.motor] || baseMotor}** (repite los casos de 52 semanas antes)`;
    const pocoInf = r.controlEstatalPocoInformativo && comp.smape_bases
      ? ` Por estado es una referencia poco informativa: su error en ${AMBITO_CONTROL.smape_bases(sinSexo)} fue sMAPE ${uno(comp.smape_bases.control)} en esa prueba.`
      : '';
    const aut = r.controlDelegado ? 'por un dictamen tomado bajo delegación del autor' : 'por autorización del autor';
    return `Lo publicado corresponde al **control estacional, no validado** (${comoSerie}) [1]. ` +
      `El portafolio de modelos seleccionado fue rechazado en la prueba única retrospectiva de **${m.anio}** porque empeoraba ${lista(fallas)}, y ${aut} se publica el control estacional; **el rechazado fue el portafolio seleccionado, no el control publicado** [1]. ` +
      `Como control estacional no tiene validación prospectiva que superar: el avance **${m.wa} de ${m.wr}** semanas (**${v.verdict}**) es únicamente un contador técnico de registro con cada boletín, no un indicador de calidad ni una validación en curso [1]. ` +
      `Error del control en aquella prueba retrospectiva de ${m.anio} (distinta de la vista de ${v.origin[0]}, sMAPE): ${lista(errs)}.${pocoInf}`;
  }
  const motorTxt = serieRef ? `Motor de la serie: **${MOTOR_ES[serieRef.motor] || serieRef.motor}** [1]. ` : '';
  const prosp = m.wa === 0
    ? `la validación prospectiva está en curso (0 de ${m.wr} semanas observadas tras el origen; pronóstico aún no validado)`
    : (v.verdict === 'PASS'
      ? `la validación prospectiva completó ${m.wa} de ${m.wr} semanas (veredicto **PASS**)`
      : `la validación prospectiva está en curso con **${m.wa} de ${m.wr}** semanas observadas (veredicto **${v.verdict}**; pronóstico aún no validado, sin fallo del portafolio)`);
  return `${motorTxt}Su portafolio de modelos fue **aceptado en la prueba única retrospectiva de ${m.anio}**${prueba ? `: ${prueba.frase}` : '.'} Esa prueba retrospectiva no equivale a la validación del pronóstico publicado: ${prosp} [1].`;
}

export function vistaGroundedAnswer(query, history, {
  leerVista,
  leerFicha,
  notasFicha = () => [],
  pruebaSuperada = () => null,
  emitidoCivil = () => '',
  avisosFuenteRag = () => '',
}) {
  const { query: qResuelta, estado } = resolverConsultaRag(query, history);
  if (!estado || estado.tipo !== 'release' || estado.releases.length !== 1) return null;
  if (CONSEJO_CLINICO.test(normPal(qResuelta))) return null;
  if (!estado.geos.length && GENERICO_ESTATAL.test(normPal(qResuelta))) return null;
  if (estado.pideEstado && !estado.debeDetallarSerieVista) return null;
  if (!estado.pideVista) return null;

  const r = estado.releases[0];
  let v;
  let html = '';
  try { v = leerVista(r.id); } catch { return null; }
  if (!v?.series) return null;
  try { html = leerFicha(r.pagina); } catch { /* ficha opcional */ }

  const prueba = pruebaSuperada(html);
  const m = metaVista(r, v, prueba?.anio);
  const seriesKeys = Object.keys(v.series);
  const sinSexo = !seriesKeys.some((k) => k.endsWith('|hombres'));
  const emitido = emitidoCivil(v);
  const incert = String(v.uncertainty_label || 'pronóstico puntual sin intervalos').replace(/^P/, 'p');
  const geos = estado.geos.length ? estado.geos : [{ nivel: 'nacional', nombre: 'Nacional' }];
  if (geos.length > 4) {
    return {
      answer: `Puedo detallar hasta cuatro geografías a la vez para **${m.nombre}**. Consulta la serie completa en [su página](../${r.pagina}).`,
      retrieval: 'vista',
      sources: [{ n: 1, source: `Release publicado ${v.release_id}`, title: m.nombre, section: r.id, url: `../${r.pagina}` }],
    };
  }
  if (sinSexo && estado.sexo && estado.sexo !== 'general') {
    const etiSexo = estado.sexo === 'ambos' ? 'hombres y mujeres por separado' : estado.sexo;
    const sGen = hallarSerie(v, geos[0], 'general');
    const extra = sGen
      ? `\n\nEn la serie general sin desglose por sexo para **${geoEtiqueta(sGen)}**, el pronóstico de ${v.horizon_weeks} semanas (**${m.wIni}** a **${m.wFin}**, corte **${m.wOr}**${emitido}) es de **${ent(sGen.pronostico_52_total)} casos** (${incert}) [1]. ${resumenMetodo(r, v, m, prueba, sGen, sinSexo)}`
      : '';
    return {
      answer: `**${m.nombre}**: el boletín no desglosa sexo; sus ${seriesKeys.length} series publicadas son por entidad y nacional, así que no existe pronóstico para ${etiSexo} [1].${extra}\n\nDetalle en [su página](../${r.pagina}).${avisosFuenteRag(r.id)}`,
      retrieval: 'vista',
      sources: [{
        n: 1,
        source: `Release publicado ${v.release_id}`,
        title: `${m.nombre} — vista publicada`,
        section: r.id,
        url: `../${r.pagina}`,
        snippet: `${m.nombre}: ${seriesKeys.length} series sin desglose por sexo (corte ${m.wOr}, horizonte ${m.wIni} a ${m.wFin}).`,
      }],
    };
  }

  const sexos = estado.sexo === 'ambos' ? ['hombres', 'mujeres'] : [estado.sexo || 'general'];
  const bloques = [];
  const elegidas = [];
  for (const g of geos) {
    for (const sx of sexos) {
      const s = hallarSerie(v, g, sx);
      if (!s) continue;
      elegidas.push(s);
      const lugar = s.nivel === 'nacional' ? `a nivel **nacional** (${sx})` : `para **${geoEtiqueta(s)}** (${sx})`;
      let txt = `El pronóstico de **${m.nombre}** ${lugar} en el horizonte de ${v.horizon_weeks} semanas desde el origen (**${m.wIni}** a **${m.wFin}**, entrenado con datos hasta **${m.wOr}**${emitido}) es de **${ent(s.pronostico_52_total)} casos** (${incert}) [1].`;
      if (s.oos?.semanas > 0 && s.oos.smape !== null) {
        const wOos = s.oos.semanas === 1 ? m.wIni : `${m.wIni} a ${semana(semanaSig(v.origin, s.oos.semanas))}`;
        const obsLbl = s.oos.semanas === 1
          ? `1 observación semanal registrada en la vista actual (**${wOos}**)`
          : `${s.oos.semanas} semanas observadas en la vista actual (**${wOos}**)`;
        const notaPre = m.preEm && s.oos.semanas === 1 ? ', ya pública antes de emitir y no prospectiva respecto de la información' : '';
        txt += ` En ${obsLbl}, tras el corte de entrenamiento **${m.wOr}**${notaPre}, se registraron **${ent(s.oos.observado_total)} casos observados** frente a **${ent(s.oos.pronostico_total)} pronosticados**, con **MAE de ${num(s.oos.mae)} casos**, **sMAPE de ${pct(s.oos.smape)} %** y **sesgo de ${pct(s.oos.sesgo_pct)} %** [1]. Estas métricas corresponden únicamente a **${wOos}** en la vista actual y **no pertenecen a la prueba retrospectiva de ${m.anio}** [1].`;
      } else {
        txt += ` En la vista actual aún no hay semanas observadas evaluadas después del corte **${m.wOr}** [1].`;
      }
      bloques.push(txt);
    }
  }
  if (!elegidas.length) return null;

  const notas = !v.caida_al_control ? notasFicha(html) : [];
  const notasTxt = notas.length
    ? `\n\nLo que declara su página sobre el error y los datos:\n${notas.map((n) => `- **${n.titulo}** ${n.texto}`).join('\n')}`
    : '';
  const s0 = elegidas[0];
  const w0 = s0.oos?.semanas ? (s0.oos.semanas === 1 ? m.wIni : `${m.wIni}–${semana(semanaSig(v.origin, s0.oos.semanas))}`) : null;
  const snippet = `${m.nombre} (${geoEtiqueta(s0)}, ${s0.sexo}): ${ent(s0.pronostico_52_total)} casos en ${m.wIni}–${m.wFin} (corte ${m.wOr}). ` +
    (w0 && s0.oos.smape !== null
      ? `Vista ${w0} (${s0.oos.semanas} obs., no prueba ${m.anio}): ${ent(s0.oos.observado_total)} obs. vs ${ent(s0.oos.pronostico_total)} pron., sMAPE ${pct(s0.oos.smape)} %, MAE ${num(s0.oos.mae)}. `
      : '') +
    `${m.estCorto}.`;
  return {
    answer: `${bloques.join('\n\n')}\n\n${resumenMetodo(r, v, m, prueba, s0, sinSexo)}${r.cronologia ? `\n\n${r.cronologia}` : ''}${notasTxt}\n\nDetalle en [su página](../${r.pagina}).${avisosFuenteRag(r.id)}`,
    retrieval: 'vista',
    sources: [{
      n: 1,
      source: `Release publicado ${v.release_id}`,
      title: `${m.nombre} — vista publicada (${geoEtiqueta(s0)}, ${s0.sexo})`,
      section: r.id,
      url: `../${r.pagina}`,
      snippet: snippet.slice(0, 320),
    }],
  };
}

export function enriquecerSemanticoVista({ foco = [], searchQuery = '', hits = [], leerVista }) {
  const C = globalThis.EPI_CATALOGO;
  if (!C) return { extraFacts: '', hits, snippets: new Map() };
  const vistas = new Map();
  const lineas = [];
  const geos = detectarGeos(searchQuery);
  const sx = detectarSexo(searchQuery) || 'general';
  const cargar = (id) => {
    if (vistas.has(id)) return vistas.get(id);
    const r = C.releases.find((x) => x.id === id);
    if (!r) return null;
    try {
      const v = leerVista(id);
      if (v?.series) {
        const info = { r, v, m: metaVista(r, v) };
        vistas.set(id, info);
        return info;
      }
    } catch { /* sin vista */ }
    return null;
  };
  for (const id of foco.slice(0, 3)) {
    const info = cargar(id);
    if (!info) continue;
    const { r, v, m } = info;
    let l = `${m.nombre}: corte entrenamiento ${m.wOr}, horizonte ${m.wIni} a ${m.wFin}; ${m.estCorto}.`;
    if (m.wOos && m.nac?.oos.smape !== null) {
      l += ` Nacional (general): 52 sem = ${ent(m.nac.pronostico_52_total)} casos; vista actual en ${m.wOos} (${m.nac.oos.semanas} obs., NO prueba ${m.anio}): ${ent(m.nac.oos.observado_total)} obs. vs ${ent(m.nac.oos.pronostico_total)} pron., MAE ${num(m.nac.oos.mae)}, sMAPE ${pct(m.nac.oos.smape)} %, sesgo ${pct(m.nac.oos.sesgo_pct)} %. Todas las métricas fuera de muestra por estado en los pasajes son de ${m.wOos} (vista actual), NUNCA de la prueba de ${m.anio}.`;
    }
    for (const g of geos.slice(0, 2)) {
      const s = hallarSerie(v, g, sx === 'ambos' ? 'general' : sx);
      if (s) {
        l += ` Serie ${geoEtiqueta(s)} (${s.sexo}): 52 sem = ${ent(s.pronostico_52_total)} casos` +
          (s.oos?.semanas && s.oos.smape !== null
            ? `; vista ${m.wIni}: ${ent(s.oos.observado_total)} obs. vs ${ent(s.oos.pronostico_total)} pron., MAE ${num(s.oos.mae)}, sMAPE ${pct(s.oos.smape)} %, sesgo ${pct(s.oos.sesgo_pct)} % (vista actual, NO prueba ${m.anio}).`
            : '.');
      }
    }
    if (r.cronologia) l += ` Cronología: ${r.cronologia}`;
    lineas.push(l);
  }
  const snippets = new Map();
  const hitsLimpios = hits.map((h) => {
    const cid = String(h.chunk?.id || '');
    if (!cid.startsWith('release:')) return h;
    const info = cargar(h.chunk.section);
    if (!info) return h;
    const { m } = info;
    const text = m.preEm
      ? String(h.chunk.text || '').replace('; las semanas evaluadas se registraron después de la emisión', '; semana evaluada tras el corte de entrenamiento, pública antes de emitir')
      : h.chunk.text;
    let snip = `${m.nombre} (corte ${m.wOr}, horizonte ${m.wIni}–${m.wFin}). ${m.estCorto}.`;
    if (cid.endsWith(':nacional') && m.nac) {
      snip += ` Nacional: ${ent(m.nac.pronostico_52_total)} casos (52 sem)` +
        (m.wOos && m.nac.oos.smape !== null
          ? `; vista ${m.wOos} (no ${m.anio}): ${ent(m.nac.oos.observado_total)} obs. vs ${ent(m.nac.oos.pronostico_total)} pron., sMAPE ${pct(m.nac.oos.smape)} %, MAE ${num(m.nac.oos.mae)}.`
          : '.');
    } else if (cid.endsWith(':estados')) {
      snip += m.wOos ? ` Vista por entidad en ${m.wOos} (${m.nac.oos.semanas} obs. tras ${m.wOr}, no prueba ${m.anio}).` : ' Pronóstico de 52 semanas por entidad.';
    }
    snippets.set(cid, snip.slice(0, 280));
    return text === h.chunk.text ? h : { ...h, chunk: { ...h.chunk, text } };
  });
  return {
    extraFacts: lineas.length ? ['=== CONTRATO TEMPORAL Y CIFRAS DE LA VISTA PUBLICADA (no confundir vista actual con prueba retrospectiva) ===', ...lineas].join('\n') : '',
    hits: hitsLimpios,
    snippets,
  };
}
