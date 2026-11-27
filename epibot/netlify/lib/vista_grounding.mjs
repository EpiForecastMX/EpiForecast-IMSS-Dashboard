/**
 * vista_grounding.mjs — Respuestas estructuradas desde `publication/<id>/vista.json` y proveniencia
 * temporal en el contexto/snippets semánticos de rag.mjs, sin valores numéricos hardcodeados.
 */
import {
  CONSEJO_CLINICO,
  GENERICO_ESTATAL,
  PIDE_ESTRATO_EDAD,
  detectarGeos,
  detectarSexo,
  esIntencionMetodologica,
  normPal,
  resolverConsultaRag,
} from './vista_turno.mjs';
import {
  ent,
  geoEtiqueta,
  hallarSerie,
  lista,
  metaVista,
  metricasDetalladas,
  rangoOos,
  resumenMetodo,
  resumenOosCorto,
  tieneValor,
} from './vista_formato.mjs';
import { periodoPedido, lineaMes } from '../../js/mes_calendario.js';

export { esIntencionMetodologica, rangoOos, resolverConsultaRag };

export function vistaGroundedAnswer(query, history, {
  turno = null,
  leerVista,
  leerFicha,
  notasFicha = () => [],
  pruebaSuperada = () => null,
  emitidoCivil = () => '',
  avisosFuenteRag = () => '',
}) {
  const { query: qResuelta, estado } = turno || resolverConsultaRag(query, history);
  if (!estado || estado.tipo !== 'release' || estado.releases.length !== 1) return null;
  if (estado.esMetodologica || CONSEJO_CLINICO.test(normPal(qResuelta))) return null;
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
  if (estado.estratoEdad) {
    const desglose = sinSexo ? 'entidad y total nacional' : 'entidad y sexo';
    return {
      answer: `**${m.nombre}**: las series publicadas del boletín sólo desglosan ${desglose} (sin estratificación por grupos de edad), así que no existe pronóstico específico por edad [1].\n\nDetalle de las series generales en [su página](../${r.pagina}).${avisosFuenteRag(r.id)}`,
      retrieval: 'vista',
      sources: [{
        n: 1,
        source: `Release publicado ${v.release_id}`,
        title: `${m.nombre} — alcance de series`,
        section: r.id,
        url: `../${r.pagina}`,
        snippet: `${m.nombre}: series publicadas sin estratificación por edad (corte ${m.wOr}, horizonte ${m.wIni} a ${m.wFin}).`,
      }],
    };
  }
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
    const extra = sGen && tieneValor(sGen.pronostico_52_total)
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
  // Deuda del detector (27-nov-2026): con un mes pedido, la respuesta empieza por ese mes, igual que el KB (decisión 4, mismo
  // módulo); antes la función daba sólo el total del horizonte.
  const pMes = periodoPedido(query);
  const mesDe = (s, sx) => {
    // Ronda 1 (Codex Sol): un año que el periodo no reconoce («marzo de 2028», fuera del horizonte) no se sustituye por otro.
    // Ronda 2 (Codex Sol): tampoco si junto al año reconocido hay otro («marzo de 2028 comparado con 2027»).
    const anios = String(query).match(/\b\d{4}\b/g) || [];
    // Ronda 3 (Codex Sol): cifras de otros sistemas de numeración («٢٠٢٨») tampoco se leen como si no hubiera año.
    // Ronda 5 (Codex Sol): sólo con una geografía y un sexo, como el KB (que compara sin línea de mes).
    if (pMes?.tipo !== 'mes' || !(s.observado || []).length || anios.some((a) => Number(a) !== pMes.anio) ||
        geos.length > 1 || estado.sexo === 'ambos' || /\b(por sexo|by sex|ambos sexos|hombres y mujeres|men and women)\b/i.test(normPal(String(query))) ||
        /(?![0-9])\p{Nd}/u.test(String(query))) return null;
    const ultimo = s.observado.at(-1)[0];
    const mie = new Date(`${ultimo.slice(0, 10)}T00:00:00Z`);
    mie.setUTCDate(mie.getUTCDate() - mie.getUTCDay() + 3);
    const lugar = s.nivel === 'nacional' ? ' en el país' : s.nivel === 'estado' ? ` en ${s.nombre === 'México' ? 'Estado de México' : s.nombre}` : ` en la ${/^regi[oó]n /i.test(s.nombre) ? s.nombre.replace(/^R/, 'r') : `región ${s.nombre}`}`;
    return lineaMes(pMes, (s.pronostico || []).filter(([ds]) => ds > ultimo), s.observado, String(mie.getUTCFullYear()),
      `${lugar}${sx && sx !== 'general' ? ` (${sx})` : ''}`);
  };
  const elegidas = [];
  for (const g of geos) {
    for (const sx of sexos) {
      const s = hallarSerie(v, g, sx);
      if (!s || !tieneValor(s.pronostico_52_total)) continue;
      elegidas.push(s);
      const lugar = s.nivel === 'nacional' ? `a nivel **nacional** (${sx})` : `para **${geoEtiqueta(s)}** (${sx})`;
      const linMes = mesDe(s, sx);
      let txt = `${linMes ? `${linMes}\n\n` : ''}El pronóstico de **${m.nombre}** ${lugar} en el horizonte de ${v.horizon_weeks} semanas desde el origen (**${m.wIni}** a **${m.wFin}**, entrenado con datos hasta **${m.wOr}**${emitido}) es de **${ent(s.pronostico_52_total)} casos** (${incert}) [1].`;
      if (s.oos?.semanas > 0) {
        const wOos = rangoOos(v.origin, s.oos.semanas, ' a ');
        const obsLbl = s.oos.semanas === 1
          ? `1 observación semanal registrada en la vista actual (**${wOos}**)`
          : `${s.oos.semanas} semanas observadas en la vista actual (**${wOos}**)`;
        const notaPre = !m.preEm
          ? ''
          : (s.oos.semanas === 1
            ? ', ya pública antes de emitir y no prospectiva respecto de la información'
            : `, donde la primera semana (**${m.wIni}**) ya era pública antes de emitir y las posteriores se registraron tras la emisión`);
        const conteo = tieneValor(s.oos.observado_total) && tieneValor(s.oos.pronostico_total)
          ? `se registraron **${ent(s.oos.observado_total)} casos observados** frente a **${ent(s.oos.pronostico_total)} pronosticados**`
          : 'se registró seguimiento observado en la vista';
        const mets = metricasDetalladas(s.oos);
        const detMet = mets.length ? `, con ${lista(mets)}` : ' (sin métricas de error calculables en ese corte)';
        txt += ` En ${obsLbl}, tras el corte de entrenamiento **${m.wOr}**${notaPre}, ${conteo}${detMet} [1]. Estas métricas corresponden únicamente a **${wOos}** en la vista actual y **no pertenecen a la prueba retrospectiva de ${m.anio}** [1].`;
      } else {
        txt += ` En la vista actual aún no hay semanas observadas evaluadas después del corte **${m.wOr}** [1].`;
      }
      bloques.push(txt);
    }
  }
  if (!elegidas.length) return null;

  const notas = !v.caida_al_control && v.portafolio_igual_al_control !== true ? notasFicha(html) : [];
  const notasTxt = notas.length ? `\n\nLo que declara su página sobre el error y los datos:\n${notas.map((n) => `- **${n.titulo}** ${n.texto}`).join('\n')}` : '';
  const s0 = elegidas[0];
  const w0 = rangoOos(v.origin, s0.oos?.semanas, '–');
  const detSnip = w0 ? resumenOosCorto(s0.oos, false) : '';
  const snippet = `${m.nombre} (${geoEtiqueta(s0)}, ${s0.sexo}): ${ent(s0.pronostico_52_total)} casos en ${m.wIni}–${m.wFin} (corte ${m.wOr}). ` +
    (w0 ? `Vista ${w0} (${s0.oos.semanas} obs., no prueba ${m.anio})${detSnip ? `: ${detSnip}` : ''}. ` : '') +
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
  const pideEdad = PIDE_ESTRATO_EDAD.test(normPal(searchQuery));
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
    if (pideEdad) l += ' Las series publicadas no tienen estratificación por grupos de edad.';
    if (m.wOos && m.nac?.oos?.semanas > 0 && tieneValor(m.nac.pronostico_52_total)) {
      const detNac = resumenOosCorto(m.nac.oos);
      l += ` Nacional (general): 52 sem = ${ent(m.nac.pronostico_52_total)} casos; vista actual en ${m.wOos} (${m.nac.oos.semanas} obs., NO prueba ${m.anio})${detNac ? `: ${detNac}` : ''}. Todas las métricas fuera de muestra por estado en los pasajes son de ${m.wOos} (vista actual), NUNCA de la prueba de ${m.anio}.`;
    }
    for (const g of geos.slice(0, 2)) {
      const s = hallarSerie(v, g, sx === 'ambos' ? 'general' : sx);
      if (s && tieneValor(s.pronostico_52_total)) {
        const wGeo = rangoOos(v.origin, s.oos?.semanas, ' a ');
        const detGeo = wGeo ? resumenOosCorto(s.oos) : '';
        l += ` Serie ${geoEtiqueta(s)} (${s.sexo}): 52 sem = ${ent(s.pronostico_52_total)} casos` +
          (wGeo ? `; vista ${wGeo} (${s.oos.semanas} obs., vista actual, NO prueba ${m.anio})${detGeo ? `: ${detGeo}` : ''}.` : '.');
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
    const nSem = m.nac?.oos?.semanas ?? 0;
    const reemplazoPre = nSem === 1
      ? '; semana evaluada tras el corte de entrenamiento, ya pública antes de emitir'
      : `; la primera semana evaluada (${m.wIni}) ya era pública antes de emitir y las siguientes son posteriores a la emisión`;
    const text = m.preEm && nSem > 0
      ? String(h.chunk.text || '').replace('; las semanas evaluadas se registraron después de la emisión', reemplazoPre)
      : h.chunk.text;
    if (cid.split(':').length > 3) {
      let snip = `${m.nombre} (corte ${m.wOr}, horizonte ${m.wIni}–${m.wFin}). ${m.estCorto}.`;
      if (cid.endsWith(':nacional') && m.nac && tieneValor(m.nac.pronostico_52_total)) {
        const detNacSnip = m.wOos ? resumenOosCorto(m.nac.oos, false) : '';
        snip += ` Nacional: ${ent(m.nac.pronostico_52_total)} casos (52 sem)` +
          (m.wOos ? `; vista ${m.wOos} (no ${m.anio})${detNacSnip ? `: ${detNacSnip}` : ''}.` : '.');
      } else if (cid.endsWith(':estados')) {
        snip += m.wOos ? ` Vista por entidad en ${m.wOos} (${nSem} obs. tras ${m.wOr}, no prueba ${m.anio}).` : ' Pronóstico de 52 semanas por entidad.';
      }
      snippets.set(cid, snip.slice(0, 280));
    }
    return text === h.chunk.text ? h : { ...h, chunk: { ...h.chunk, text } };
  });
  return {
    extraFacts: lineas.length ? ['=== CONTRATO TEMPORAL Y CIFRAS DE LA VISTA PUBLICADA (no confundir vista actual con prueba retrospectiva) ===', ...lineas].join('\n') : '',
    hits: hitsLimpios,
    snippets,
  };
}
