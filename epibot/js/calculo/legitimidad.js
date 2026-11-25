/**
 * calculo/legitimidad.js — qué preguntas no tienen respuesta con estos datos, y cómo decirlo (mesa agéntica, fase 1).
 *
 * Dictamen de epidemiología de la mesa (25-nov-2026): «la inteligencia aquí es saber qué pregunta no tiene respuesta con
 * estos datos y decirlo con claridad». Las vistas publicadas son conteos de casos notificados, sin población, sin
 * intervalos y sin variables causales. Dos tipos de salida:
 * - `notasDeLegitimidad(q)`: salvedades que preceden a una respuesta con datos (significancia, brote, causas).
 * - `negativaRazonada(q, nPadecimientos)`: preguntas que no se contestan con cifras (relación entre padecimientos, sumarlos).
 * Recibe la consulta ya normalizada (minúsculas, sin tildes).
 */

const SIGNIFICANCIA = /\b(estadisticamente|significativ\w*|significancia|p ?valor|valor p|intervalo de confianza|intervalos de confianza|margen de error|nivel de confianza|desviacion estandar)\b/;
const BROTE = /\b(brote|brotes|epidemia|alerta epidemiologica|alerta sanitaria|emergencia sanitaria|contingencia)\b/;
const CAUSA = /\bpor ?que (esta |estan |va |van |se )?(subiendo|aumentando|bajando|disminuyendo|sube|suben|baja|bajan|aumenta|aumentan|disminuye|crece|crecen|creciendo|hay mas|hay menos|cayendo)\b|\b(a que se debe|cual es la causa|cuales son las causas|que lo (causa|provoca)|que esta (causando|provocando)|por culpa de)\b/;
const RELACION = /\b(pearson|spearman|coeficiente de correlacion|relacion|correlacion|correlacionad\w*|asociacion|asociad[oa]s?|tiene que ver|tienen que ver|influye|influyen|se relaciona\w*|vinculad\w*|causa de la|provoca la)\b/;
const SUMA = /\b(suma|sumo|sumas|sumamos|sumame|sumar|sumad[oa]s?|sumando|juntos|juntas|junt[oa]s|combinad[oa]s?|en conjunto|total de los dos|total de ambos|entre los dos|entre las dos)\b/;

export const NOTA_SIGNIFICANCIA = '_No calculo significancia estadística ni intervalos de confianza: los pronósticos son cifras únicas, sin rango de error. ' +
  'Para no confundir el ruido con un cambio, sólo digo que algo sube o baja si la diferencia es de al menos 10 % y mayor que la variación normal de los conteos._';
export const NOTA_BROTE = '_No declaro brotes ni alertas: eso lo hace la autoridad sanitaria con su vigilancia epidemiológica. ' +
  'Lo que sí puedo decirte es cómo van los casos notificados frente a las mismas semanas del año pasado._';
export const NOTA_CAUSA = '_No puedo decir por qué cambian los casos: los pronósticos usan sólo los casos notificados, sin clima, vacunación ni otras causas. ' +
  'Esto es lo que muestran los datos._';
const ACIERTO = /\b(acert\w*|le atin\w*|ha atinado|atinandole|atino|atinado)\b/;
const RIESGO = /\b(riesgo|riesgos|probabilidad|probabilidades|mas probable|probable que (me|le|nos|te))\b/;
const PERSONAL = /\b(tengo|tendre|tendria|me|mi|yo|nos|cada (persona|hombre|mujer|habitante)|una persona|alla|aca)\b/;
export const NOTA_ACIERTO = '_Para decir que un pronóstico acierta hacen falta al menos 4 semanas comprobadas con datos reales; ' +
  'la confiabilidad de cada serie dice cuántas lleva y cuánto se desvió._';
export const NOTA_RIESGO = '_Más casos notificados no significan más riesgo para una persona: no ajusto por población ni por exposición, ' +
  'y no calculo probabilidades individuales._';

/** Salvedades que van antes de una respuesta con datos. */
export function notasDeLegitimidad(qn) {
  const notas = [];
  if (SIGNIFICANCIA.test(qn)) notas.push(NOTA_SIGNIFICANCIA);
  if (BROTE.test(qn)) notas.push(NOTA_BROTE);
  if (CAUSA.test(qn)) notas.push(NOTA_CAUSA);
  if (ACIERTO.test(qn)) notas.push(NOTA_ACIERTO);
  if (RIESGO.test(qn)) notas.push(NOTA_RIESGO);
  return notas;
}

/** ¿La consulta pregunta por un brote? (entonces «¿hay brote?» no se contesta «Sí» con una tendencia). */
export const preguntaPorBrote = (qn) => BROTE.test(qn);

/**
 * Negativa con motivo para preguntas sobre dos o más padecimientos que no se contestan con cifras.
 * `nombres` son los padecimientos reconocidos en la consulta, para ofrecerlos por separado.
 */
export function negativaRazonada(qn, nombres) {
  if (!nombres || nombres.length < 2) return null;
  const lista = nombres.slice(0, 3).join(' y ');
  if (RELACION.test(qn) && !/\b(compar\w*|vs|contra|cual|mas casos|sube mas)\b/.test(qn)) {
    return { motivo: 'relacion', texto: `No puedo decirte si ${lista} están relacionados: comparar dos curvas de casos no muestra una relación ni una causa ` +
      '(pueden subir juntas por la temporada o por cómo se notifican). Para eso hacen falta estudios epidemiológicos.\n\n' +
      `Lo que sí puedo hacer es darte cómo va cada uno; por ejemplo, «compara ${lista}».` };
  }
  if (SUMA.test(qn)) {
    return { motivo: 'suma', texto: `No sumo ${lista}: son padecimientos distintos, con definiciones y pronósticos propios, y un mismo caso podría contarse en más de uno. ` +
      `Te los doy por separado si me dices «compara ${lista}».` };
  }
  return null;
}

/** «¿Puedo decir que allá tengo el doble de riesgo?»: sin padecimiento nuevo, la negativa sin cifras. */
export function negativaRiesgo(qn) {
  if (!RIESGO.test(qn) || !PERSONAL.test(qn)) return null;
  return 'No: más casos notificados en un lugar no quieren decir más riesgo para una persona. Aquí hay conteos de casos, sin ajustar ' +
    'por población ni por exposición, y no calculo probabilidades individuales. Un estado con más habitantes tiene más casos aunque el ' +
    'riesgo de cada persona sea igual o menor. Para tu situación particular, consulta a tu unidad de salud.';
}
