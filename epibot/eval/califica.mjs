/**
 * eval/califica.mjs — califica si el EpiBot ACIERTA, no sólo si «no falla» (mesa agéntica, fase 0, 25-nov-2026).
 *
 * Hallazgo de la mesa (evaluación): la métrica «limpia» de las pruebas de estrés cuenta como buena una respuesta con el
 * padecimiento o el estado equivocados, y las 813 preguntas curadas traen etiquetas (`espera`, `padecimiento`, `estado`)
 * que ninguna prueba leía. Este calificador las usa:
 *
 * - `datos`: la respuesta debe nombrar el padecimiento etiquetado y el estado etiquetado, y traer cifras. Además, un oráculo
 *   independiente recalcula desde la vista publicada las dos cifras de la respuesta llana («Ahora: N casos» y «unos N casos
 *   en las próximas 4 semanas») con una implementación propia, sin importar código del bot.
 * - Las demás categorías se califican con reglas de texto declaradas abajo (heurísticas, reportadas aparte).
 *
 * Uso: node eval/califica.mjs [salida.json] [bateria …]   (sin red; lee las vistas del repositorio)
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';

const raiz = new URL('../../', import.meta.url);
globalThis.fetch = async (u) => {
  const s = String(u?.url ?? u);
  const m = s.match(/(publication\/[a-z0-9_]+\/vista\.json|assets\/boletin\/[^?]+\.json)/);
  const local = s.match(/(knowledge|zoom_series|resumen_padecimientos|comparacion_rondas)\.json/);
  const rel = m ? m[1] : (local ? `epibot/${local[1]}.json` : null);
  if (!rel || !existsSync(new URL(rel, raiz))) return { ok: false, json: async () => null };
  return { ok: true, json: async () => JSON.parse(readFileSync(new URL(rel, raiz), 'utf-8')) };
};
Math.random = () => 0.42;
const kb = await import('../js/kb.js');
const { RELEASES } = await import('../js/release_config.js');
await kb.loadKnowledge();

const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const LEGACY = [['dengue', 'Dengue'], ['depresion', 'Depresión'], ['parkinson', 'Parkinson'], ['alzheimer', 'Alzheimer']];

/** Releases que corresponden a la etiqueta de padecimiento (comparación de nombres normalizados, sin el NLU del bot). */
export function esperados(etiqueta) {
  const e = norm(etiqueta);
  if (!e) return [];
  const leg = LEGACY.filter(([k]) => e === k || e.startsWith(`${k} `) || e.includes(` ${k}`)).map(([id, nombre]) => ({ id, nombre, legacy: true }));
  if (leg.length) return leg;
  const exactos = RELEASES.filter((r) => [r.nombre, r.nombreCorto, r.consulta, r.pad, r.etiqueta].some((n) => norm(n) === e));
  if (exactos.length) return exactos;
  return RELEASES.filter((r) => [r.nombre, r.nombreCorto, r.consulta, ...(r.alias || [])].some((n) => {
    const x = norm(n);
    return x.length >= 4 && (x.includes(e) || e.includes(x));
  }));
}

const nombres = (r) => [r.nombre, r.nombreCorto, r.consulta, r.consultaVisible].filter(Boolean).map(norm).filter((x) => x.length >= 3);
const ESTADO_ALT = { 'estado de mexico': ['estado de mexico', 'edomex'], 'ciudad de mexico': ['ciudad de mexico', 'cdmx'], 'mexico': ['estado de mexico'] };
const nombraEstado = (txt, estado) => (ESTADO_ALT[norm(estado)] || [norm(estado)]).some((x) => ` ${txt} `.includes(` ${x} `));
const sexoDe = (q) => (/\b(mujeres|mujer|femenin\w*)\b/.test(norm(q)) ? 'mujeres' : /\b(hombres|hombre|varones|masculin\w*)\b/.test(norm(q)) ? 'hombres' : 'general');

/** Oráculo independiente: O4 y F4 de la serie de la vista. */
export function oraculo(vista, estado, sexo) {
  const series = Object.values(vista.series || {});
  const x = estado
    ? series.find((s) => s.nivel === 'estado' && s.sexo === sexo && (norm(s.nombre) === norm(estado) || (norm(s.nombre) === 'mexico' && norm(estado) === 'estado de mexico')))
    : series.find((s) => s.nivel === 'nacional' && s.sexo === sexo);
  if (!x || !(x.observado || []).length) return null;
  const obs = x.observado;
  const ultimo = obs[obs.length - 1][0];
  let O4 = 0;
  for (let i = Math.max(0, obs.length - 4); i < obs.length; i++) O4 += Number(obs[i][1]) || 0;
  const fut = (x.pronostico || []).filter((p) => p[0] > ultimo).slice(0, 4);
  const F4 = fut.length === 4 ? fut.reduce((a, p) => a + Number(p[1]), 0) : null;
  return { O4: Math.round(O4), F4: F4 == null ? null : Math.round(F4) };
}
const entero = (s) => Number(String(s).replace(/[,\s ]/g, ''));

const REGLAS = {
  no_modelado: (md) => /no (se )?modela|no tiene pron[oó]stico|sin pron[oó]stico|no est[aá] modelad|no (lo |la )?pronostic|cifras impresas|bolet[ií]n/i.test(md),
  ranking: (md, h) => h === 'answerRankingPadecimientos' || /al alza|van subiendo|suben m[aá]s|m[aá]s casos/i.test(md),
  confiabilidad: (md) => /confiab/i.test(md),
  definicion: (md) => md === '' || /\bes (una|un|el|la|cuando)\b|MedlinePlus|se (le )?llama|consiste/i.test(md),
  metodologia: (md) => md === '' || /modelo|m[eé]todo|valid|prueba|control|sMAPE|motor/i.test(md),
  alcance: (md) => md === '' || /no |s[oó]lo|solamente|plataforma|publica/i.test(md),
  charla: (md) => md !== '' && !/\d{3,}/.test(md),
  fuera_de_tema: (md) => /no respondo|fuera del proyecto|no (puedo|tengo)|s[oó]lo (respondo|puedo)|EpiForecast/i.test(md),
  sintomas: (md) => /diagnostic|acude|unidad de salud|911|m[eé]dic/i.test(md),
  aclaracion: (md) => /\?|dime|precisa|cu[aá]l de|aclara/i.test(md),
};

const arriba = (md) => md.split('<!--DETALLE-->')[0].replace(/<!--[\s\S]*?-->/g, '');

export async function califica(items) {
  const res = { total: 0, aciertos: 0, por_espera: {}, datos: { n: 0, padecimiento_ok: 0, estado_ok: 0, cifras_ok: 0, todo_ok: 0, sin_oraculo_pad: 0, oraculo_comparado: 0, oraculo_ok: 0 }, fallos: [] };
  for (const it of items) {
    if (!it.espera) continue;
    kb._resetContext();
    let r = { response: null, handler: null };
    for (const t of it.turnos) r = await kb.answerWithTrace(t);
    kb._resetContext();
    const md = String(r.response ?? '');
    const a = arriba(md);
    const n = norm(a);
    const pe = (res.por_espera[it.espera] ||= { n: 0, ok: 0 });
    pe.n++; res.total++;
    let ok;
    let motivo = '';
    if (it.espera === 'datos') {
      const D = res.datos; D.n++;
      const esp = esperados(it.padecimiento);
      const padOk = esp.length ? esp.some((x) => nombres(x).some((nm) => ` ${n} `.includes(` ${nm} `))) : null;
      if (padOk === null) D.sin_oraculo_pad++;
      const estOk = !it.estado || nombraEstado(n, it.estado);
      const cifOk = /\d/.test(a.replace(/\b(19|20)\d{2}\b/g, ''));
      if (padOk) D.padecimiento_ok++;
      if (estOk) D.estado_ok++;
      if (cifOk) D.cifras_ok++;
      ok = padOk !== false && estOk && cifOk;
      if (ok) D.todo_ok++;
      motivo = [padOk === false && 'padecimiento', !estOk && 'estado', !cifOk && 'sin cifras'].filter(Boolean).join(', ');
      // Oráculo de cifras de la respuesta llana.
      const rel = esp.length === 1 && !esp[0].legacy ? esp[0] : null;
      const ahora = a.match(/\*\*Ahora:\*\* ([\d,  ]+) casos?/);
      if (rel && ahora && padOk) {
        const v = kb.getData()?.[rel.dataKey];
        // El sexo se hereda entre turnos («¿y en mujeres?» → «¿y Sinaloa?» sigue en mujeres).
        const sx = it.turnos.map(sexoDe).filter((x) => x !== 'general').at(-1) || 'general';
        const o = v && oraculo(v, it.estado, sx);
        if (o) {
          D.oraculo_comparado++;
          const f4 = a.match(/unos ([\d,  ]+) casos? (esperados )?en las pr[oó]ximas 4/);
          const bien = entero(ahora[1]) === o.O4 && (!f4 || o.F4 == null || entero(f4[1]) === o.F4);
          if (bien) D.oraculo_ok++;
          else { ok = false; motivo = `cifra: dice ${ahora[1]}${f4 ? `/${f4[1]}` : ''}, oráculo ${o.O4}/${o.F4}`; }
        }
      }
    } else {
      const regla = REGLAS[it.espera];
      ok = regla ? !!regla(a.trim(), r.handler) && !/No entendí bien|No reconozco algunos/.test(md) : true;
      if (!ok) motivo = 'regla';
    }
    if (ok) { pe.ok++; res.aciertos++; } else res.fallos.push({ espera: it.espera, q: it.turnos.join(' → '), handler: r.handler, motivo, inicio: a.trim().slice(0, 160) });
  }
  return res;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const salida = process.argv[2];
  const nombresB = process.argv.slice(3).length ? process.argv.slice(3) : ['ciudadanos', 'profesionales', 'ciega', 'ciega2', 'coloquial'];
  const informe = {};
  for (const b of nombresB) {
    const items = JSON.parse(readFileSync(new URL(`../tests/fixtures/estres/${b}.json`, import.meta.url), 'utf-8'));
    informe[b] = await califica(items);
    const x = informe[b];
    const D = x.datos;
    console.log(`${b}: ${x.aciertos}/${x.total} aciertos (${(100 * x.aciertos / x.total).toFixed(1)} %) · datos ${D.todo_ok}/${D.n} ` +
      `(padecimiento ${D.padecimiento_ok}, estado ${D.estado_ok}, cifras ${D.cifras_ok}, oráculo ${D.oraculo_ok}/${D.oraculo_comparado})`);
  }
  const tot = Object.values(informe).reduce((a, x) => ({ n: a.n + x.total, ok: a.ok + x.aciertos }), { n: 0, ok: 0 });
  console.log(`TOTAL: ${tot.ok}/${tot.n} (${(100 * tot.ok / tot.n).toFixed(1)} %)`);
  if (salida) writeFileSync(salida, JSON.stringify(informe, null, 1));
}
