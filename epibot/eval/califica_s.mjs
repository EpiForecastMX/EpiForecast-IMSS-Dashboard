/**
 * eval/califica_s.mjs — califica la batería ciega S (mesa agéntica, fase 0, 25-nov-2026).
 *
 * La batería vive fuera del repositorio (`planes/mesa_epibot_agentico_2026-11-25/bateria_s/`), sellada por SHA-256: *dev*
 * para iterar y *test* para abrirse una sola vez. Cada pregunta trae `tipo` (simple, compuesta, trampa), `padecimientos`
 * (ids), `estados`, `intencion` y `espera` (respuesta, negativa, aclaracion). Reglas:
 * - respuesta: nombra el padecimiento (todos, si compara padecimientos) y el estado (todos, si compara estados) y trae
 *   cifras cuando la intención las pide; «explícame la gráfica» debe explicarla.
 * - negativa o aclaración: la respuesta trae una salvedad o una pregunta, y nunca empieza con «Sí.».
 * Una respuesta vacía (cede a la IA de respaldo) se cuenta aparte como «cede»: sin red no se puede calificar.
 *
 * Uso: node eval/califica_s.mjs BATERIA.jsonl [salida.json]   (DATOS_RAIZ=<repo> para leer vistas de otra copia)
 */
import { existsSync, readFileSync, writeFileSync } from 'fs';

const raiz = process.env.DATOS_RAIZ ? new URL(`file://${process.env.DATOS_RAIZ.replace(/\/?$/, '/')}`) : new URL('../../', import.meta.url);
const fetchReal = globalThis.fetch;
globalThis.fetch = async (u, init) => {
  const s = String(u?.url ?? u);
  // Las URL absolutas (proveedor del modelo, Ollama) van a la red: la evaluación pareada las necesita.
  if (/^https?:\/\//.test(s) && !/(publication\/|assets\/boletin\/|knowledge|zoom_series|resumen_padecimientos|comparacion_rondas)/.test(s)) return fetchReal(u, init);
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
const LEGACY = { dengue: ['dengue'], depresion: ['depresion'], parkinson: ['parkinson'], alzheimer: ['alzheimer'] };
const nombresDe = (id) => LEGACY[id] || (() => {
  const r = RELEASES.find((x) => x.id === id);
  return r ? [r.nombre, r.nombreCorto, r.consulta, r.consultaVisible].filter(Boolean).map(norm).filter((x) => x.length >= 3) : [];
})();
const ESTADO_ALT = { 'estado de mexico': ['estado de mexico', 'edomex'], 'ciudad de mexico': ['ciudad de mexico', 'cdmx'] };
const nombra = (txt, xs) => xs.some((x) => ` ${txt} `.includes(` ${x} `));
const CON_CIFRAS = new Set(['casos', 'tendencia', 'periodo', 'comparar_estados', 'comparar_padecimientos', 'pico', 'estacionalidad', 'vs_anio', 'multiple']);
const SALVEDAD = /\bNo (calculo|declaro|puedo|sumo|doy|tengo|hay pron|se puede|significa|equivale|indica|es (un|una) (riesgo|tasa|probabilidad))|no muestra una relaci|sin ajustar por poblaci|s[oó]lo cubren|no (lo|la) pronostic|no modela|no tiene pron[oó]stico|no puedo diagnosticar|No es (un|una)|no se (pueden|puede) (comparar|sumar|decir)|casos notificados, no|no es consejo|no diagnostic/i;
const arriba = (md) => md.split('<!--DETALLE-->')[0].replace(/<!--[\s\S]*?-->/g, '');

/** Califica una respuesta ya obtenida: { ok, cede, motivo }. La usa también la evaluación pareada (compara_agente.mjs). */
export function calificaUna(it, md0) {
  const md = String(md0 ?? '');
  if (!md.trim()) return { ok: false, cede: true, motivo: 'cede' };
  const a = arriba(md);
  const n = norm(a);
  if (it.espera === 'respuesta') {
    const pads = (it.padecimientos || []).map(nombresDe).filter((x) => x.length);
    const padOk = !pads.length || (it.intencion === 'comparar_padecimientos' ? pads.every((p) => nombra(n, p)) : pads.some((p) => nombra(n, p)));
    const ests = (it.estados || []).map((e) => ESTADO_ALT[norm(e)] || [norm(e)]);
    const estOk = !ests.length || (it.intencion === 'comparar_estados' ? ests.every((e) => nombra(n, e)) : nombra(n, ests[0]));
    const cifOk = !CON_CIFRAS.has(it.intencion) || /\d/.test(a.replace(/\b(19|20)\d{2}\b/g, ''));
    const grafOk = it.intencion !== 'explicar_grafica' || /C[oó]mo leer la gr[aá]fica/.test(a);
    const ok = padOk && estOk && cifOk && grafOk && !/No entendí bien|No reconozco algunos/.test(md);
    return { ok, cede: false, motivo: [!padOk && 'padecimiento', !estOk && 'estado', !cifOk && 'sin cifras', !grafOk && 'gráfica'].filter(Boolean).join(', ') };
  }
  return { ok: (SALVEDAD.test(a) || /\?/.test(a)) && !/^\s*S[ií]\. /m.test(a), cede: false, motivo: 'sin salvedad' };
}

export async function calificaS(items) {
  const res = { total: 0, ok: 0, cede: 0, por_tipo: {}, por_intencion: {}, fallos: [] };
  for (const it of items) {
    kb._resetContext();
    let r = { response: null, handler: null };
    for (const t of it.turnos) r = await kb.answerWithTrace(t);
    kb._resetContext();
    const md = String(r.response ?? '');
    const a = arriba(md);
    const n = norm(a);
    res.total++;
    const pt = (res.por_tipo[it.tipo] ||= { n: 0, ok: 0, cede: 0 });
    const pi = (res.por_intencion[it.intencion] ||= { n: 0, ok: 0 });
    pt.n++; pi.n++;
    if (!md.trim()) { res.cede++; pt.cede++; res.fallos.push({ id: it.id, q: it.turnos.join(' → '), motivo: 'cede', handler: r.handler }); continue; }
    let ok, motivo = '';
    if (it.espera === 'respuesta') {
      const pads = (it.padecimientos || []).map(nombresDe).filter((x) => x.length);
      const padOk = !pads.length || (it.intencion === 'comparar_padecimientos' ? pads.every((p) => nombra(n, p)) : pads.some((p) => nombra(n, p)));
      const ests = (it.estados || []).map((e) => ESTADO_ALT[norm(e)] || [norm(e)]);
      const estOk = !ests.length || (it.intencion === 'comparar_estados' ? ests.every((e) => nombra(n, e)) : nombra(n, ests[0]));
      const cifOk = !CON_CIFRAS.has(it.intencion) || /\d/.test(a.replace(/\b(19|20)\d{2}\b/g, ''));
      const grafOk = it.intencion !== 'explicar_grafica' || /C[oó]mo leer la gr[aá]fica/.test(a);
      ok = padOk && estOk && cifOk && grafOk && !/No entendí bien|No reconozco algunos/.test(md);
      motivo = [!padOk && 'padecimiento', !estOk && 'estado', !cifOk && 'sin cifras', !grafOk && 'gráfica'].filter(Boolean).join(', ');
    } else {
      ok = (SALVEDAD.test(a) || /\?/.test(a)) && !/^\s*S[ií]\. /m.test(a);
      motivo = 'sin salvedad';
    }
    if (ok) { res.ok++; pt.ok++; pi.ok++; } else res.fallos.push({ id: it.id, q: it.turnos.join(' → '), motivo, handler: r.handler, inicio: a.trim().slice(0, 160) });
  }
  return res;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const items = readFileSync(process.argv[2], 'utf-8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
  const res = await calificaS(items);
  const p = (x) => `${x.ok}/${x.n}${x.cede ? ` (cede ${x.cede})` : ''}`;
  console.log(`TOTAL ${res.ok}/${res.total} (${(100 * res.ok / res.total).toFixed(1)} %), cede ${res.cede} · ` +
    Object.entries(res.por_tipo).map(([k, v]) => `${k} ${p(v)}`).join(' · '));
  console.log(Object.entries(res.por_intencion).map(([k, v]) => `${k} ${v.ok}/${v.n}`).join(' · '));
  if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(res, null, 1));
}
