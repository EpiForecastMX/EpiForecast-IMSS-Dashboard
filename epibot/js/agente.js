/**
 * agente.js — lógica del planificador en el cliente (mesa agéntica, fase 3, 25-nov-2026), compartida por la página (app.js) y
 * la evaluación pareada (eval/compara_agente.mjs). Sin DOM ni red: recibe el plan ya pedido y la función `answer` del KB.
 */
import { detectEntities, norm } from './entities.js?v=88';
import { RELEASES, releaseDePad, releasesEnConsulta } from './release_config.js?v=59';

/** ¿La frase pide varias cosas? («… y además …», «… también dime …», dos signos de interrogación). */
export function pareceVariosPedidos(text) {
  const t = norm(text);
  return /\b(y ademas|ademas de eso|y tambien|tambien dime|y luego|y de paso|aparte dime|y otra cosa)\b/.test(t) || (String(text).match(/\?/g) || []).length >= 2;
}
/** Respuesta de un paso dentro de una respuesta compuesta: sin ficha técnica, botones ni marcas de gráfica. */
const DESCARGO_LLANO = /\n*_Son casos notificados al boletín epidemiológico[^\n]*_/;
export function parteDePlan(md) {
  return String(md).split('<!--DETALLE-->')[0].replace(/\n?<!--SIGUE:.*?-->/g, '').replace(/<!--SIN_GRAFICA-->/g, '').replace(DESCARGO_LLANO, '').trim();
}
/**
 * Pasos cuyo padecimiento la frase no nombra: si queda exactamente un padecimiento nombrado sin paso, se usa ése (con el mismo
 * lugar e intención); si no, el paso se descarta. Si el KB no reconoce ningún padecimiento en la frase, el plan queda igual.
 */
export function corrigePlan(consultas, padsTexto) {
  if (!padsTexto.size) return consultas;
  const ajenos = (c) => [...padsReconocidos(c)].filter((p) => !padsTexto.has(p));
  const cubiertos = new Set(consultas.flatMap((c) => [...padsReconocidos(c)].filter((p) => padsTexto.has(p))));
  const libres = [...padsTexto].filter((p) => !cubiertos.has(p));
  const malos = consultas.filter((c) => ajenos(c).length);
  return consultas.map((c) => {
    const x = ajenos(c);
    if (!x.length) return c;
    if (malos.length !== 1 || libres.length !== 1 || x.length !== 1) return null;
    const malo = RELEASES.find((r) => r.id === x[0]);
    const bueno = RELEASES.find((r) => r.id === libres[0]);
    if (!malo || !bueno || bueno.sensible) return null;
    const viejo = [malo.consultaVisible, malo.consulta].find((t) => t && c.includes(t));
    return viejo ? c.replace(viejo, bueno.consultaVisible || bueno.consulta) : null;
  }).filter(Boolean);
}

/** Padecimientos que el propio KB reconoce en un texto (ids de release y nombres de los cuatro originales). */
export function padsReconocidos(t) {
  const n = norm(t);
  const ent = detectEntities(t);
  return new Set([...releasesEnConsulta(n, { prefijos: true }).map((r) => r.id),
    ...[ent.padecimiento, ...(ent.padecimientos || [])].filter(Boolean).map((p) => releaseDePad(p)?.id || p)]);
}
/**
 * Respuesta compuesta a partir del plan: corrige o descarta pasos cuyo padecimiento la frase no nombra, contesta cada paso
 * con el KB (`answer`) y une las partes. Devuelve el markdown o null si el plan no aporta (menos de dos pasos con un KB que
 * ya respondió).
 */
export async function respuestaDePlan(plan, text, yaRespondio, answer) {
    // Control determinista: si la frase nombra padecimientos que el KB reconoce, un paso con otro padecimiento se descarta
    // (en la prueba con qwen2.5:14b, «piquetes de alacrán» se volvió «mordedura de araña viuda negra»).
    const padsTexto = padsReconocidos(text);
    const consultas = corrigePlan(plan.consultas, padsTexto);
    const descartados = plan.descartados + plan.consultas.length - consultas.length;
    if (consultas.length >= 2 || (!yaRespondio && consultas.length === 1)) {
      const partes = [];
      for (const c of consultas) {
        let r = null;
        try { r = await answer(c); } catch (err) { console.error('KB error:', err); }
        if (r && !/No entendí bien|Lamento que estés|Sigo aquí contigo/.test(r)) partes.push({ c, r });
      }
      const aviso = descartados ? `\n\n_No entendí ${descartados === 1 ? 'una parte' : `${descartados} partes`} de tu pregunta; pregúntamela por separado._` : '';
      if (partes.length === 1) return `_Entendí: «${partes[0].c}»._\n\n${partes[0].r}${aviso}`;
      else if (partes.length > 1) {
        return `_Lo dividí en ${partes.length} preguntas:_\n\n` +
          partes.map((x, i) => `**${i + 1}. ${x.c}**\n\n${parteDePlan(x.r)}`).join('\n\n---\n\n') + aviso +
          (partes.some((x) => DESCARGO_LLANO.test(x.r)) ? `\n\n${partes.map((x) => x.r.match(DESCARGO_LLANO)?.[0].trim()).find(Boolean)}` : '') + '\n<!--SIN_GRAFICA-->';
      }
    }
  return null;
}
