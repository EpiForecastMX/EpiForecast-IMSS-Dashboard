/**
 * memoria.js — memoria de lugar de la conversación (mesa agéntica, fase 1, 25-nov-2026).
 *
 * El calificador con etiquetas encontró que el lugar que la persona ya dijo se perdía: «Hola, soy enfermera en Mexicali»
 * recibía «¿Quisiste decir…?» y luego «diabetes tipo 1 en mi estado» respondía «No sé en qué estado estás». Una
 * presentación con lugar y sin padecimiento se contesta y deja el estado en el contexto (kb.js lo usa en
 * `seguimientoConContexto`). Sólo se recuerda el estado de la conversación en curso; nada se guarda entre visitas.
 */

const PRESENTA = /^(hola |buenas |buenos dias |buenas tardes |buenas noches |que tal |oye )*(yo )?(soy|me llamo [a-z]+ (y )?soy|trabajo (como|en)|vivo en|estoy en|ando en|te escribo (desde|de)|escribo desde|les escribo desde)\b/;

export function answerPresentacion(q0, ent) {
  if (!ent.estado || ent.padecimiento || (ent.padecimientos || []).length) return null;
  const q = String(q0 || '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!PRESENTA.test(q) || q.split(' ').length > 14) return null;
  // «baja» como verbo, no como parte de «Baja California».
  if (/\b(cuantos|cuantas|casos|como va|como esta|pronostico|hay mas|sube|baja(?! california))\b/.test(q)) return null;
  return `Hola. Tomo nota de que estás en **${ent.estado}**: pregúntame por un padecimiento y te respondo para ${ent.estado}. ` +
    'Por ejemplo, «¿cómo va la diabetes?» o «¿cómo va el dengue?».\n<!--SIN_GRAFICA-->';
}

const MI_LUGAR = /\b(en |de |para )?mi (estado|ciudad|entidad|region|zona|municipio|pueblo|localidad)\b/g;

/**
 * Reescritura por memoria de lugar: «en mi estado» con un estado ya dicho, y un padecimiento nombrado justo después de
 * hablar sólo de un estado. Devuelve la consulta reescrita o null.
 */
export function conLugarRecordado(qn, ent, ctx) {
  if (ent.estado || !ctx.estado) return null;
  if (MI_LUGAR.test(qn)) {
    MI_LUGAR.lastIndex = 0;
    return `${qn.replace(MI_LUGAR, ' ').replace(/\s+/g, ' ').trim()} en ${ctx.estado}`;
  }
  MI_LUGAR.lastIndex = 0;
  if (ent.padecimiento && ctx._resumenEstado && !ctx.padecimiento && !/\b(nacional|pais|republica|todo mexico|en mexico)\b/.test(qn)) {
    return `${qn} en ${ctx.estado}`;
  }
  return null;
}
