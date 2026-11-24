/**
 * conversacion.js — charla, ayuda, síntomas y ranking entre padecimientos (rediseño conversacional, 24-nov-2026).
 *
 * La mesa redonda encontró que el EpiBot no respondía «gracias», «¿qué puedes hacer?» ni «tengo fiebre, ¿qué hago?», y
 * que el saludo hablaba de motores y de cuatro padecimientos cuando el sitio publica 152. Estos handlers van al inicio de
 * la cadena de kb.js. Ninguno da consejo médico ni cifras inventadas: el ranking sale de resumen_padecimientos.json, que
 * genera scripts/build_resumen_padecimientos.mjs desde las vistas publicadas.
 */
import { RELEASES } from './release_config.js?v=55';

const LEGACY = 4;
export const TOTAL_PUBLICADOS = () => RELEASES.length + LEGACY;
const ent0 = (n) => Math.round(n).toLocaleString('es-MX');
const MESES_C = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** «2 de noviembre de 2026» desde una fecha ISO. */
const fecha = (ds) => { const [a, m, d] = String(ds).split('-').map(Number); return d ? `${d} de ${MESES_C[m - 1]} de ${a}` : String(ds); };
const pct0 = (n) => `${Math.round(Math.abs(n * 100))} %`;
const palabras = (q) => q.split(' ').filter(Boolean);
const sigue = (xs) => `\n<!--SIGUE:${JSON.stringify(xs)}-->`;

const EJEMPLOS = [
  { t: '¿Cómo va el dengue en Veracruz?', q: '¿cómo va el dengue en Veracruz?' },
  { t: '¿Sube la diabetes en Nuevo León?', q: '¿está subiendo la diabetes en Nuevo León?' },
  { t: '¿Qué enfermedades van al alza?', q: '¿qué enfermedades van al alza?' },
  { t: '¿Qué es la escabiosis?', q: '¿qué es la escabiosis?' },
];

const SALUDO = /^(hola|holi|hey|buenas|buenos dias|buenas tardes|buenas noches|buen dia|que tal|que onda|saludos|hello|hi)\b/;
const GRACIAS = /^(muchas |mil )?(gracias|grax|thanks|thank you|te agradezco|muy amable|excelente gracias|ok gracias|vale gracias|perfecto gracias)\b/;
const DESPEDIDA = /^(adios|bye|hasta luego|hasta pronto|nos vemos|chao|chau|me voy)\b/;
const AYUDA = /\b(como le hago|como veo|como busco|como se escribe|como pregunto|como lo uso|que puedes hacer|que sabes hacer|que haces|en que me ayudas|en que me puedes ayudar|como te uso|como funciona esto|ayuda|help|que te puedo preguntar|que puedo preguntar|para que sirves|instrucciones)\b/;

export function saludo() {
  return `¡Hola! Soy **EPI**. Te digo cómo van **${TOTAL_PUBLICADOS()} padecimientos** en México, por estado y por sexo, con los datos ` +
    'del boletín epidemiológico de la Secretaría de Salud: cuántos casos hay, si suben o bajan, qué se espera en las próximas ' +
    'semanas y qué tan confiable es cada pronóstico.\n\n' +
    'Pregúntame como le preguntarías a una persona, por ejemplo:\n' +
    EJEMPLOS.map((e) => `- «${e.t}»`).join('\n') + '\n<!--SIN_GRAFICA-->' + sigue(EJEMPLOS);
}

/** «hola», «gracias», «adiós» y «¿qué puedes hacer?» (sólo cuando el turno no trae además una pregunta de datos). */
export function answerCharla(q, ent) {
  const conDatos = !!(ent.padecimiento || ent.estado || (ent.padecimientos || []).length);
  const n = palabras(q).length;
  if (!conDatos && (GRACIAS.test(q) || (/\bgracias\b/.test(q) && n <= 6)) && n <= 8) {
    return 'Con gusto. ¿Quieres revisar otro padecimiento o estado?\n<!--SIN_GRAFICA-->' + sigue(EJEMPLOS.slice(0, 3));
  }
  if (!conDatos && /\b(tqm|te quiero|eres lo maximo|buen bot|que buen bot|me caes bien|eres genial)\b/.test(q) && n <= 8) {
    return '¡Gracias! Aquí sigo para lo que necesites: pregúntame cómo va un padecimiento en tu estado.\n<!--SIN_GRAFICA-->' + sigue(EJEMPLOS.slice(0, 3));
  }
  if (!conDatos && /\b(nervios[oa]|preocupad[oa]|me da miedo|tengo miedo|me asusta|asustad[oa]) (con|por|de) (tantas |las |la |los )?(enfermedad\w*|epidemia\w*|brotes?|contagios?|noticias)\b/.test(q)) {
    return 'Es normal preocuparse. Saber qué está pasando ayuda: te puedo decir qué enfermedades van al alza o a la baja en tu estado, con datos del boletín. Si la preocupación no te deja en paz y quieres hablar con alguien, la **Línea de la Vida** atiende gratis, las 24 horas: **800 911 2000**.\n<!--SIN_GRAFICA-->' + sigue(EJEMPLOS.slice(0, 3));
  }
  if (!conDatos && /\b(estoy cansad[oa]|algo alentador|dame animos|animame|necesito animos|un consejo alentador)\b/.test(q)) {
    return 'Ánimo: descansar también es cuidarte. Si el cansancio viene de algo que te pesa y quieres hablar con alguien, la **Línea de la Vida** atiende gratis, las 24 horas: **800 911 2000**.\n<!--SIN_GRAFICA-->';
  }
  if (/\b(salir conmigo|ir a la playa conmigo|conmigo esta|tienes novi[oa]|eres guap[oa]|cita conmigo|te gustaria ir)\b/.test(q)) {
    return 'Gracias por la invitación, pero soy un asistente automático: lo mío son los datos de salud. ¿Te ayudo con algún padecimiento?\n<!--SIN_GRAFICA-->';
  }
  if (/\b(estudiar (epidemiologia|medicina|salud publica|enfermeria)|quiero ser (medic[oa]|epidemiolog[oa]|enfermer[oa]))\b/.test(q)) {
    return '¡Qué buena meta! La epidemiología es justo lo que hay detrás de estos datos. Si quieres practicar, pregúntame cómo va un padecimiento en tu estado o qué enfermedades van al alza.\n<!--SIN_GRAFICA-->' + sigue(EJEMPLOS.slice(0, 3));
  }
  if (!conDatos && DESPEDIDA.test(q) && n <= 5) {
    return 'Hasta luego. Aquí estaré cuando quieras revisar cómo va algún padecimiento.\n<!--SIN_GRAFICA-->';
  }
  if (!conDatos && AYUDA.test(q) && n <= 10) {
    return 'Puedo ayudarte con esto, sobre **' + TOTAL_PUBLICADOS() + ' padecimientos** del boletín epidemiológico:\n\n' +
      '- **Cómo va un padecimiento** en el país o en tu estado: casos recientes frente al año pasado y si sube o baja.\n' +
      '- **Qué se espera** en las próximas semanas, en un mes o en una temporada.\n' +
      '- **Dónde hay más casos** y cómo se comparan hombres y mujeres.\n' +
      '- **Qué tan confiable** es cada pronóstico, explicado sin tecnicismos.\n' +
      '- **Qué enfermedades van al alza** en todo el país.\n\n' +
      'No doy diagnósticos ni consejo médico. Escribe tu pregunta con tus palabras; si no entiendo algo, te diré qué sí entendí.' +
      '\n<!--SIN_GRAFICA-->' + sigue(EJEMPLOS);
  }
  if (!conDatos && SALUDO.test(q) && n <= 5) return saludo();
  return null;
}

// Síntomas o petición de diagnóstico: nunca se diagnostica ni se receta.
const SINTOMA = /\b(me duele|le duele|duele|dolor|azucar alta|infecciones intestinales|infecciones respiratorias agudas|tos(?! ferina)|tose|fiebre|ronchas?|manchas?|granitos?|granos con agua|acne|vomita|vomitando|no quiere comer|muy flac[oa]|dejo de comer|presion en \d+|se quemo|quemadura|piojos|liendres|sarna|comezon|calentura|diarrea|vomito|vomitos|nauseas|ronchas|sarpullido|comezon|dolor de cabeza|dolor de garganta|dolor de estomago|dolor de huesos|escalofrios|gripa|gripe|moqueo|mareo|mareos|sangrado|granos|manchas en la piel|ojos rojos|cansancio)\b/;
const PERSONAL = /\b(mi (hij[oa]|nin[oa]|bebe|abuel[ao]|abuelita|abuelito|mama|papa|espos[oa]|herman[oa]|niet[oa])|a mi (hij[oa]|nin[oa]|bebe)|tengo|me duele|me salio|me salieron|me siento|(ando|estoy|amaneci) con (tos|fiebre|gripa|gripe|calentura|diarrea|vomito|dolor|ronchas|comezon)|mi (hijo|hija|mama|papa|bebe|esposa|esposo|abuelo|abuela|nino|nina) (tiene|trae|anda con)|me pico|me mordio)\b/;
const PIDE_DX = /\b(es sintoma de|sintoma de algo|puede ser sintoma|puede ser algo|sera algo|algo mas grave|es grave|es normal|que hago|que debo hacer|que me tomo|que tomo|que le doy|es dengue|sera dengue|tengo dengue|sera que tengo|me estoy enfermando|a donde voy|a donde acudo)\b/;

/** Turno personal con síntomas que además pide datos: la respuesta de datos lleva esta nota al inicio. */
export function notaSintomas(q) {
  if (/\bembarazad\w*\b/.test(q) && /\b(presion|hipertension|preeclampsia|dolor de cabeza|vision borrosa|hinchazon)\b/.test(q)) {
    return '_En el embarazo, la presión alta con dolor de cabeza intenso, visión borrosa, zumbido de oídos o hinchazón es una urgencia: acude a urgencias o llama al 911._';
  }
  return SINTOMA.test(q) && PERSONAL.test(q)
    ? '_No puedo diagnosticar. Si hay fiebre muy alta, dificultad para respirar, sangrado o deshidratación, acude a urgencias o llama al 911._'
    : null;
}

const FAMILIAR_DX = /\b(mi|a mi|un|una) (hij[oa]|nin[oa]|bebe|abuel[ao]|mama|papa|espos[oa]|herman[oa]|amig[oa]|sobrin[oa]|tio|tia)\b/;
const URGENCIA = /\b(sangrando|sangra (por|de|mucho)|sangrado (por|de) (el ojo|la nariz|la boca|el oido)|no respira|le cuesta respirar|no puede respirar|se ahoga|convulsion\w*|se desmayo|desmayado|inconsciente|perdio el conocimiento|golpe en la cabeza|se puso morad[oa]|labios morados)\b/;
export function answerSintomas(q, ent) {
  if (URGENCIA.test(q)) {
    return 'Esto puede ser una **urgencia**: llama al **911** o acude a urgencias ahora. No puedo dar orientación médica ni diagnosticar.\n<!--SIN_GRAFICA-->';
  }
  const dxFuerte = /\b(es sintoma de|sintoma de algo|puede ser sintoma|puede ser algo|sera algo|algo mas grave)\b/.test(q) && (PERSONAL.test(q) || FAMILIAR_DX.test(q));
  if (!dxFuerte && (!SINTOMA.test(q) || !(PERSONAL.test(q) || PIDE_DX.test(q)))) return null;
  const pad = ent.padecimiento;
  // Si además pide datos («mi hijo se quemó, ¿cuántos casos de quemaduras hay?»), responde los datos con la nota de seguridad.
  if (pad && /\b(cuantos|cuantas|casos|hay|como va|brote|estadisticas|anda un|anda la|anda el)\b/.test(q)) return null;
  if (/\b(se quemo|me queme|quemadura|quemaduras)\b/.test(q) && /\b(aceite|agua|cuete|cohete|polvora|estufa|plancha|sol|a donde|que hago|que le pongo)\b/.test(q)) {
    return 'Si la quemadura es grande, profunda, con ampollas extensas o está en la cara, las manos, los genitales o las articulaciones, acude a urgencias o llama al **911**. Mientras, enfría la zona con agua corriente (no helada) y no apliques remedios caseros. No puedo dar indicaciones de tratamiento.\n<!--SIN_GRAFICA-->';
  }
  if (/\b(que (debe|puede|deberia) comer|que le doy de comer|dieta|que alimentos|que comida)\b/.test(q)) {
    return 'No doy indicaciones de alimentación ni de tratamiento: eso debe definirlo su médico o un nutriólogo, según su caso. ' +
      'Si hay síntomas de alarma, acude a urgencias o llama al **911**.\n<!--SIN_GRAFICA-->';
  }
  if (/\b(no quiere comer|muy flac[oa]|dejo de comer|vomita a proposito)\b/.test(q)) {
    return 'Si notas que alguien deja de comer, baja mucho de peso o vomita a propósito, consulta pronto a un médico: puede tratarse de un trastorno de la conducta alimentaria, que tiene tratamiento. ' +
      'Para orientación en salud mental, la **Línea de la Vida** atiende gratis, las 24 horas: **800 911 2000**.\n\nSi te sirve, puedo darte cómo van los casos de anorexia, bulimia y otros trastornos alimentarios en tu estado.\n<!--SIN_GRAFICA-->' +
      sigue([{ t: 'Trastornos alimentarios', q: '¿cómo va la anorexia?' }]);
  }
  if (/\bpresion en (1[6-9]\d|2\d\d)\b/.test(q)) {
    return 'Una presión de 180 o más es una **urgencia**: acude a urgencias o llama al **911**, sobre todo si hay dolor de pecho, falta de aire, dolor de cabeza intenso, visión borrosa o debilidad de un lado del cuerpo. ' +
      'No puedo dar indicaciones de tratamiento.\n<!--SIN_GRAFICA-->';
  }
  const oferta = pad
    ? `\n\nSi te sirve, puedo decirte cómo van los casos de ${pad.toLowerCase()} en tu estado.`
    : '\n\nSi te sirve, puedo decirte qué padecimientos están circulando más en tu estado.';
  return 'No puedo diagnosticarte ni recomendarte un tratamiento: soy un asistente de datos epidemiológicos.\n\n' +
    '- Si hay **fiebre muy alta, dificultad para respirar, sangrado, dolor intenso, confusión o deshidratación**, acude a urgencias o llama al **911**.\n' +
    '- Si los síntomas son leves, consulta en tu unidad de salud o con tu médico; evita automedicarte.' + oferta +
    '\n<!--SIN_GRAFICA-->' + sigue(pad
    ? [{ t: `¿Cómo va ${pad.toLowerCase()}?`, q: `¿cómo va ${pad.toLowerCase()}?` }]
    : [{ t: '¿Qué enfermedades van al alza?', q: '¿qué enfermedades van al alza?' }]);
}

// «¿Qué enfermedades van al alza?», «¿qué está subiendo?», «¿qué padecimientos tienen más casos?».
const RANKING = /\b(enfermedad|enfermedades|padecimiento|padecimientos|infecciones|males)\b.*\b(alza|aumentar|aumentando|aumentan|aumento|en aumento|incremento|suben|subiendo|subir|subio|crecen|creciendo|crecio|repuntan|preocupar|preocupantes|mas casos|bajan|bajando|bajaron|bajado|bajo|disminuyen|disminuyendo|disminuyo|pegando)\b|\b(que|cuales?)\b.*\b(enfermedades|padecimientos)\b.*\b(alza|aumentar|aumentando|aumentan|suben|subiendo|subir|crecen|creciendo|repuntan|preocupar|preocupantes|mas casos|bajan|bajando|disminuyen)\b|\b(que esta subiendo|que va al alza|que sube|que esta aumentando|que esta bajando|lo que sube|lo que mas sube|que esta pegando|que pega mas|que anda (mas )?fuerte|que esta circulando|que circula mas|que hay mas|vamos a tener mas casos|pronostico (para|de) esta semana|pronostico general)\b/;

const RESUMEN_NACIONAL = /\b(resumen|panorama general|situacion epidemiologica|como esta el pais|como va el pais|que esta pasando en el pais)\b/;
export function answerRankingPadecimientos(q, ent, s, d) {
  const nacional = !ent.estado || /^nacional$/i.test(String(ent.estado));
  if (ent.padecimiento || (ent.padecimientos || []).length || !nacional) return null;
  const resumen = RESUMEN_NACIONAL.test(q);
  if (!RANKING.test(q) && !resumen) return null;
  const res = d?.resumen_padecimientos;
  if (!res || !Array.isArray(res.padecimientos)) {
    return 'Todavía no tengo el resumen de todos los padecimientos. Pregúntame por uno en particular; por ejemplo, «¿cómo va la varicela?».\n<!--SIN_GRAFICA-->';
  }
  const relevantes = res.padecimientos.filter((x) => Math.max(x.O4, x.F4) >= 50);
  const orden = (xs) => [...xs].sort((a, b) => (a.confiabilidad === 'baja') - (b.confiabilidad === 'baja') || Math.abs(b.delta) - Math.abs(a.delta));
  const suben = orden(relevantes.filter((x) => x.tendencia === 'sube')).slice(0, 6);
  const bajan = orden(relevantes.filter((x) => x.tendencia === 'baja')).slice(0, 4);
  const masCasos = /\bmas casos\b/.test(q) && !resumen;
  const pideBaja = /\b(bajan|bajando|bajaron|bajado|bajo|disminuyen|disminuyendo|disminuyo|a la baja)\b/.test(q);
  const etq = (x) => (x.confiabilidad === 'baja' ? ' · _confiabilidad baja_' : x.confiabilidad === 'alta' ? ' · confiabilidad alta' : ' · confiabilidad media');
  const fila = (x) => `- **${x.nombre}**: unos ${ent0(x.F4)} casos en las próximas 4 semanas, ${x.delta >= 0 ? `${pct0(x.delta)} más` : `${pct0(x.delta)} menos`} que en las 4 anteriores (${ent0(x.O4)})${etq(x)}.`;
  const lineas = [];
  if (masCasos) {
    const top = [...res.padecimientos].sort((a, b) => b.F4 - a.F4).slice(0, 8);
    lineas.push('**Padecimientos con más casos esperados en el país** (próximas 4 semanas):', '',
      ...top.map((x) => `- **${x.nombre}**: unos ${ent0(x.F4)} casos`));
  } else {
    lineas.push(suben.length
      ? `**Lo que más se espera que suba en el país** en las próximas 4 semanas, frente a las 4 anteriores:`
      : 'Ningún padecimiento con un número relevante de casos muestra un aumento claro para las próximas 4 semanas.', '');
    if (pideBaja) {
      lineas.length = 0;
      lineas.push(bajan.length ? '**Lo que más se espera que baje en el país** en las próximas 4 semanas, frente a las 4 anteriores:' : 'Ningún padecimiento con un número relevante de casos muestra una baja clara para las próximas 4 semanas.', '', ...bajan.map(fila));
    } else {
      lineas.push(...suben.map(fila));
      if (bajan.length) lineas.push('', '**Lo que más se espera que baje:**', '', ...bajan.map(fila));
    }
  }
  if (resumen) {
    const top = [...res.padecimientos].sort((a, b) => b.F4 - a.F4).slice(0, 5);
    lineas.unshift(`**Panorama nacional** (casos notificados al boletín epidemiológico, datos hasta la semana del ${fecha(res.corte)})`, '');
    lineas.push('', '**Los que más casos tendrán:**', '', ...top.map((x) => `- **${x.nombre}**: unos ${ent0(x.F4)} casos en las próximas 4 semanas.`));
  }
  lineas.push('', `Comparo ${res.padecimientos.length} padecimientos con datos hasta la semana del ${fecha(res.corte)}; dejo fuera los de menos de 50 casos, donde un cambio porcentual engaña, ` +
    'y los temas sensibles. «Confiabilidad baja» quiere decir que el pronóstico repite el patrón del año pasado o que ya se ha desviado.',
  '', '_Son casos notificados al boletín epidemiológico; no es consejo médico._', '<!--SIN_GRAFICA-->');
  const sig = suben.slice(0, 3).map((x) => ({ t: `¿Cómo va ${x.nombre.toLowerCase()}?`, q: `¿cómo va ${x.consulta}?` }));
  return lineas.join('\n') + (sig.length ? sigue(sig) : '');
}

// ── Los cuatro originales (Dengue, Depresión, Parkinson, Alzheimer) en lenguaje llano ──────────────────────────────────
// Salen de zoom_series.json (observado reciente, pronóstico productivo y seguimiento semanal de la ronda vigente). Sólo
// responden la consulta general («dengue en Jalisco», «¿cómo va la depresión?»); los mapas, el histórico, el brote, los
// motores y las métricas siguen en sus handlers de kb.js.
const LEGACY_PAD = { Dengue: 'dengue', Depresion: 'depresion', Parkinson: 'parkinson', Alzheimer: 'alzheimer' };
const LEGACY_NOMBRE = { Dengue: 'Dengue', Depresion: 'Depresión', Parkinson: 'Parkinson', Alzheimer: 'Alzheimer' };
const LEGACY_ESPECIFICO = /\b(historic\w*|proximo brote|nino|enso|oni|2018|2019|2020|2021|2022|acumulad\w*|motor\w*|metric\w*|smape|mase|zoom|mapa|ranking|compar\w*|vs|contra|sintoma\w*|que es|que son|prevencion|prevenir|causa\w*|tratamiento|clima|lluvia\w*|modelo\w*|escenario|proyeccion|anos|rondas?|semaforo|timelapse|treemap|radar|pdf|reporte|validacion|seguimiento|calibracion|grafic\w*|tabla|por sexo|hombres y mujeres|region\w*|macrorregion\w*|mas casos|que estado|cual estado|estados|lugar|mosquito|aedes|serotipo\w*|grave|hemorragic\w*|muertes|defunciones|letalidad|edad|edades|te puede|a ti|puedes enfermarte|enfermarte|modela\w*|gana|ganara|ganador|que sabes|sabes)\b/;
const ESTADOS_NOMBRE = Object.fromEntries(['Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas',
  'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo',
  'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo',
  'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas']
  .map((e) => [e.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(), e]));
const nombreDeClave = (g) => ESTADOS_NOMBRE[g === 'mexico' ? 'estado de mexico' : g] || g;
const norm0 = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function serieLegacy(z, pad, geo, sexo) {
  const zz = z[`${LEGACY_PAD[pad]}|${geo}|${sexo}`];
  if (!zz || !Array.isArray(zz.d)) return null;
  const observado = zz.d.map((ds, i) => [ds, zz.r[i]]).filter(([ds, r]) => r != null && ds <= zz.last_real);
  const pronostico = zz.d.map((ds, i) => [ds, zz.y[i]]).filter(([, y]) => y != null);
  const seg = (zz.seguimiento || []).filter((x) => x.estado === 'par' && x.real != null && x.pronostico != null);
  const O = seg.reduce((a, x) => a + x.real, 0);
  const P = seg.reduce((a, x) => a + x.pronostico, 0);
  return {
    zz, observado, pronostico,
    oos: { semanas: seg.length, observado_total: O, pronostico_total: P, sesgo_pct: O > 0 ? (P - O) / O * 100 : 0 },
  };
}

export function answerLegacyLlano(q, ent, s, d, { respuestaLlana, confiabilidadLegacy }) {
  const pad = ent.padecimiento;
  if (!LEGACY_PAD[pad] || (ent.padecimientos || []).length > 1) return null;
  const n = ` ${norm0(q).replace(/[^a-z0-9]+/g, ' ')} `;
  if (LEGACY_ESPECIFICO.test(n)) return null;
  const z = d?.zoom_series;
  if (!z) return null;
  const sexo = ent.sexo && ent.sexo !== 'general' ? ent.sexo : 'general';
  let geo = ent.estado ? norm0(ent.estado) : 'nacional';
  if (geo === 'mexico' && z[`${LEGACY_PAD[pad]}|estado de mexico|${sexo}`]) geo = 'estado de mexico';
  const base = serieLegacy(z, pad, geo, sexo);
  if (!base || base.observado.length < 8) return null;
  const nombreGeo = geo === 'nacional' ? 'Nacional' : nombreDeClave(geo);
  const x = { ...base, nivel: geo === 'nacional' ? 'nacional' : 'estado', nombre: nombreGeo, id: geo, sexo };
  const geos = [...new Set(Object.keys(z).map((k) => k.split('|')[1]))]
    .filter((g) => g !== 'nacional' && !g.startsWith('region'))
    .filter((g) => !(g === 'mexico' && z[`${LEGACY_PAD[pad]}|estado de mexico|${sexo}`]));
  const estados = geos.map((g) => { const y = serieLegacy(z, pad, g, sexo); return y && { ...y, id: g, nombre: nombreDeClave(g), nivel: 'estado' }; }).filter(Boolean);
  const v = { uncertainty_label: base.zz.intervalo_disponible ? '' : 'sin intervalo', observation_cutoff: null };
  const r = { nombre: LEGACY_NOMBRE[pad], consulta: LEGACY_PAD[pad], consultaVisible: LEGACY_PAD[pad] };
  const lineas = respuestaLlana({ v, x, r, q, esControl: false, estados, sinSexo: false, confianzaTexto: confiabilidadLegacy(x, base.zz) });
  if (!lineas) return null;
  const sig = [
    geo === 'nacional' ? { t: '¿Dónde hay más casos?', q: `mapa de ${r.consulta}` } : { t: 'Ver el total nacional', q: `${r.consulta} nacional` },
    ...(sexo === 'general' ? [{ t: '¿Y en mujeres?', q: `${r.consulta}${geo === 'nacional' ? '' : ` en ${ent.estado}`} mujeres` }] : []),
    { t: 'Semana a semana', q: `zoom ${r.consulta}${geo === 'nacional' ? '' : ` en ${ent.estado}`}` },
    ...(pad === 'Dengue' ? [{ t: 'Histórico del dengue', q: 'historico de dengue' }] : [{ t: `¿Qué es ${r.nombre.toLowerCase()}?`, q: `que es ${r.consulta}` }]),
  ];
  return lineas.join('\n') + `\n\n<!--DETALLE-->\nMotor productivo de esta serie: **${base.zz.motor}**. Pronóstico emitido con datos hasta la semana ${base.zz.corte}; ` +
    `la comparación con lo observado se actualiza con cada boletín.${base.zz.intervalo_disponible ? '' : ' Pronóstico puntual, sin intervalo de incertidumbre.'}` +
    `\n<!--SIGUE:${JSON.stringify(sig.slice(0, 4))}-->`;
}

// «¿Qué tan confiables son sus pronósticos?» sin padecimiento: la escala de tres niveles y cuántos hay en cada uno.
const CONFIANZA_GENERAL = /\b(que tan|son|es|que tanto|se puede|puedo)\b.*\b(confiables?|fiables?|precisos?|exactos?|confiar|creer|atinan|aciertan|le atinan|son buenos|sirven)\b|\b(le atinan|atinan|aciertan|son confiables|son buenos tus|son buenos sus|fallaron|se equivocaron|error de su modelo|el error de|debo creerle|creerle a un bot|que tan seguro es este chatbot|te creen|confiabilidad del (chatbot|bot)|cometas? (un |algun )?error|te equivocas|puedes equivocarte)\b|\b(confiabilidad|precision) de (sus|tus|los|las)\b/;
export function answerConfianzaGeneral(q, ent, s, d) {
  if (ent.padecimiento || (ent.padecimientos || []).length || ent.estado) return null;
  if (!CONFIANZA_GENERAL.test(q) || ent.modelo || /\b(prophet|deepar|ensemble|stacking|nbglm|motor|motores|modelos?|smape|mase)\b/.test(q)) return null;
  const xs = d?.resumen_padecimientos?.padecimientos || [];
  const n = (nivel) => xs.filter((x) => x.confiabilidad === nivel).length;
  const conteo = xs.length
    ? `\n\nHoy, de ${xs.length} padecimientos con pronóstico nacional (sin contar los temas sensibles): **${n('alta')}** con confiabilidad alta, **${n('media')}** media y **${n('baja')}** baja.`
    : '';
  return 'Depende del padecimiento, y siempre te lo digo en cada respuesta con una de tres etiquetas:\n\n' +
    '- **Alta:** el modelo superó su prueba de aceptación con datos que no vio y además acertó en las semanas reales que siguieron a su emisión.\n' +
    '- **Media:** superó su prueba de aceptación y su comprobación con datos reales sigue en curso.\n' +
    '- **Baja:** no hay un modelo validado (se repite lo ocurrido el año anterior) o, en esa serie, el pronóstico ya se desvió más de 20 %.' +
    conteo + '\n\nTodos son cifras únicas, sin rango de error, y se comparan cada semana con el boletín epidemiológico. Pregúntame por uno en particular; por ejemplo, «¿qué tan confiable es el pronóstico de varicela?».' +
    '\n<!--SIN_GRAFICA-->' + sigue([{ t: '¿Qué tan confiable es el de varicela?', q: '¿qué tan confiable es el pronóstico de varicela?' },
      { t: '¿Qué enfermedades van al alza?', q: '¿qué enfermedades van al alza?' }]);
}

// ── Ciudades → estado ───────────────────────────────────────────────────────────────────────────────────────────────────
// El boletín publica por entidad federativa: «el dengue en Monterrey» se responde para Nuevo León y se dice. Sólo ciudades
// sin ambigüedad con un nombre de estado («León» se omite porque forma parte de «Nuevo León»).
const CIUDADES = [
  ['Chihuahua', ['sierra tarahumara', 'tarahumara']],
  ['Quintana Roo', ['riviera maya', 'costa maya']],
  ['Chiapas', ['selva lacandona']],
  ['San Luis Potosí', ['huasteca potosina', 'san luis(?! rio colorado)(?! potosi)']],
  ['Guanajuato', ['guanajuato capital']],
  ['Ciudad de México', ['iztapalapa', 'coyoacan', 'tlalpan', 'gustavo a madero', 'xochimilco', 'azcapotzalco', 'miguel hidalgo', 'venustiano carranza', 'iztacalco', 'alvaro obregon', 'magdalena contreras', 'cuajimalpa', 'milpa alta', 'tlahuac']],
  ['Nuevo León', ['mty', 'monterrey', 'san pedro garza garcia', 'apodaca', 'san nicolas de los garza', 'escobedo']],
  ['Jalisco', ['gdl', 'guadalajara', 'zapopan', 'tlaquepaque', 'tonala', 'puerto vallarta']],
  ['Baja California', ['tijuana', 'mexicali', 'ensenada', 'rosarito', 'tecate']],
  ['Baja California Sur', ['los cabos', 'cabo san lucas', 'san jose del cabo']],
  ['Yucatán', ['merida', 'valladolid', 'progreso']],
  ['Quintana Roo', ['cancun', 'playa del carmen', 'chetumal', 'cozumel', 'tulum']],
  ['Guanajuato', ['leon gto', 'leon guanajuato', 'irapuato', 'celaya', 'salamanca', 'san miguel de allende']],
  ['Chihuahua', ['ciudad juarez', 'cd juarez', 'juarez chihuahua', 'delicias', 'cuauhtemoc chihuahua']],
  ['Sinaloa', ['culiacan', 'mazatlan', 'los mochis']],
  ['Sonora', ['hermosillo', 'ciudad obregon', 'nogales', 'guaymas', 'navojoa']],
  ['Guerrero', ['acapulco', 'chilpancingo', 'iguala', 'zihuatanejo', 'taxco']],
  ['Coahuila', ['saltillo', 'torreon', 'monclova', 'piedras negras']],
  ['Estado de México', ['toluca', 'ecatepec', 'nezahualcoyotl', 'naucalpan', 'tlalnepantla', 'chimalhuacan', 'texcoco']],
  ['Michoacán', ['morelia', 'uruapan', 'zamora', 'lazaro cardenas']],
  ['Tabasco', ['villahermosa', 'cardenas tabasco']],
  ['Chiapas', ['tuxtla gutierrez', 'tuxtla', 'tapachula', 'san cristobal de las casas', 'comitan']],
  ['Veracruz', ['xalapa', 'jalapa', 'coatzacoalcos', 'boca del rio', 'poza rica', 'cordoba veracruz', 'orizaba', 'minatitlan']],
  ['Morelos', ['cuernavaca', 'cuautla', 'jiutepec']],
  ['Hidalgo', ['pachuca', 'tulancingo']],
  ['Nayarit', ['tepic']],
  ['Colima', ['manzanillo']],
  ['Tamaulipas', ['reynosa', 'matamoros', 'nuevo laredo', 'tampico', 'ciudad victoria', 'ciudad madero']],
  ['Oaxaca', ['juchitan', 'salina cruz', 'puerto escondido', 'huatulco']],
  ['Puebla', ['tehuacan', 'cholula', 'atlixco']],
  ['Durango', ['gomez palacio', 'lerdo']],
  ['San Luis Potosí', ['ciudad valles', 'matehuala']],
  ['Zacatecas', ['fresnillo']],
  ['Sinaloa', ['guasave']],
];
const CIUDAD_RE = CIUDADES.flatMap(([estado, cs]) => cs.map((c) => [estado, c.replace(/\(\?!.*?\)/g, ''), new RegExp(`\\b${c}\\b`)]))
  .sort((a, b) => b[1].length - a[1].length);
const CIUDAD_ACENTOS = { 'sierra tarahumara': 'Sierra Tarahumara', tarahumara: 'Sierra Tarahumara', 'riviera maya': 'Riviera Maya', 'costa maya': 'Costa Maya', 'selva lacandona': 'Selva Lacandona', 'huasteca potosina': 'Huasteca Potosina', 'san luis': 'San Luis', 'guanajuato capital': 'Guanajuato capital', coyoacan: 'Coyoacán', 'alvaro obregon': 'Álvaro Obregón', tlahuac: 'Tláhuac', mty: 'Monterrey', gdl: 'Guadalajara', 'leon gto': 'León', 'leon guanajuato': 'León', cancun: 'Cancún', merida: 'Mérida', culiacan: 'Culiacán', mazatlan: 'Mazatlán', torreon: 'Torreón',
  'tuxtla gutierrez': 'Tuxtla Gutiérrez', 'san cristobal de las casas': 'San Cristóbal de las Casas', 'ciudad juarez': 'Ciudad Juárez',
  'cd juarez': 'Ciudad Juárez', 'juarez chihuahua': 'Ciudad Juárez', 'ciudad obregon': 'Ciudad Obregón', nezahualcoyotl: 'Nezahualcóyotl',
  chimalhuacan: 'Chimalhuacán', 'san nicolas de los garza': 'San Nicolás de los Garza', 'san pedro garza garcia': 'San Pedro Garza García',
  tonala: 'Tonalá', 'lazaro cardenas': 'Lázaro Cárdenas', 'cardenas tabasco': 'Cárdenas', 'boca del rio': 'Boca del Río',
  minatitlan: 'Minatitlán', 'cordoba veracruz': 'Córdoba', juchitan: 'Juchitán', tehuacan: 'Tehuacán', 'gomez palacio': 'Gómez Palacio',
  comitan: 'Comitán', 'san jose del cabo': 'San José del Cabo', 'cuauhtemoc chihuahua': 'Cuauhtémoc', 'puerto vallarta': 'Puerto Vallarta',
  'ciudad madero': 'Ciudad Madero', 'san miguel de allende': 'San Miguel de Allende', jalapa: 'Xalapa' };
const NOMBRE_CIUDAD = (c) => c.replace(/\b\w/g, (x) => x.toUpperCase()).replace(/\b(De|Del|La|Las|Los)\b/g, (x) => x.toLowerCase());
/** Sustituye ciudades conocidas por su estado. Devuelve el texto (sin tildes, en minúsculas) y las notas que se dicen. */
export function ciudadesAEstados(raw) {
  let t = norm0(raw);
  const notas = [];
  for (const [estado, ciudad, re] of CIUDAD_RE) {
    if (re.test(t)) {
      t = t.replace(re, estado.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
      if (!notas.some((n) => n.estado === estado)) notas.push({ ciudad: CIUDAD_ACENTOS[ciudad] || NOMBRE_CIUDAD(ciudad), estado });
    }
  }
  return notas.length ? { texto: t, notas } : { texto: raw, notas };
}

// ── Sinónimos coloquiales y abreviaturas de estados ─────────────────────────────────────────────────────────────────────
// Se aplican antes de resolver la consulta, junto con las ciudades. Sólo reemplazos inequívocos; «mosquito» se lee como
// dengue y se dice, porque el boletín publica también chikungunya y paludismo.
const SINONIMOS = [
  [/\b(el |la )?azucar( alta)?\b|\bdiabetis\b|\bdiavetes\b|\bdiabetes melitus\b/g, 'diabetes'],
  [/\binfeccion(es)? (de (la )?orina|urinaria(s)?|de vias urinarias)\b|\bmal de orin\b|\bardor al orinar\b/g, 'infeccion de vias urinarias'],
  [/\b(chikunguna|chicungunya|chikungunia|chikungunya|chicunguya)\b/g, 'chikungunya'],
  [/\b(gripa|gripe|resfriado|resfriados|catarro|catarros)\b/g, 'infecciones respiratorias agudas'],
  [/\btos\b(?! ferina)(?=.*\b(hay|casos|cuantos|brote|anda|pegando|circulando)\b)/g, 'infecciones respiratorias agudas'],
  [/\b(el bicho|coronavirus|covid ?19)\b/g, 'covid'],
  [/\b(diarrea|diarreas|chorrillo|enfermedades? de la panza|se enferma de la panza|dolor de panza|infeccion(es)? (del estomago|estomacal(es)?|de la panza))\b/g, 'infecciones intestinales'],
  [/\b(salmonela|salmonella)\b(?! (paratyphi|typhi|enterica))/g, 'salmonelosis'],
  [/\binsufiencia\b/g, 'insuficiencia'], [/\b(varises|varizes)\b/g, 'varices'], [/\b(senores|señores|caballeros|varones)\b/g, 'hombres'], [/\b(senoras|señoras|damas)\b/g, 'mujeres'], [/\bparquinson\b/g, 'parkinson'],
  [/\b(embolia|embolias|derrame cerebral|infarto cerebral|ataque cerebral)\b/g, 'enfermedad cerebrovascular'],
  [/\b(paperas)\b/g, 'parotiditis infecciosa'], [/\b(venganza de moctezuma|diarrea del viajero)\b/g, 'infecciones intestinales'],
  [/\b(gusano barrenador|gusanos en (la )?herida)\b/g, 'miasis'], [/\bulceras? (de|del) estomago\b/g, 'ulceras gastritis y duodenitis'],
  [/\bcancer (de|en) (la )?matriz\b/g, 'cancer de utero'],
  [/\baccidentes? de transito con vehiculos? (de|con) motor\b/g, 'accidente de transporte en vehiculos con motor'],
  [/^(?!.*\b(peaton|ciclista|atropell\w*)\b)(.*)\baccidentes? (de|en|con) (moto|motos|motocicleta|motocicletas|vehiculos? de motor|carro|carros|coche|coches|auto|autos)\b/, '$2accidente de transporte en vehiculos con motor'],
  [/\b(quemados|quemadas|quemado|quemada)\b/g, 'quemaduras'],
  [/\b(preeclampsia|eclampsia)\b|\b(presion alta|presion|hipertension)\b(?=.*\bembarazad\w*)|\bembarazad\w*\b(?=.*\b(presion|hipertension)\b)/g, 'trastornos hipertensivos del embarazo'],
  [/\b(en|para|durante) (semana santa|navidad|las vacaciones|vacaciones|el puente|fin de ano|ano nuevo)\b/g, ' '], [/\bhipertencion\b/g, 'hipertension'], [/\bneumonia\b/g, 'neumonias'],
  [/\b(cifras del radar|el radar)\b(?=.*\b(categorias|modelan|modelables|boletin)\b)/g, 'radar del boletin'],
  [/\b(bronquiolitis|virus sincitial( respiratorio)?|vsr)\b/g, 'infecciones respiratorias agudas'],
  [/\b(amibas|amibiasis)\b/g, 'amebiasis'],
  [/^(?!.*\b(peaton|ciclista|motociclista|lesionado|atropell\w*)\b)(.*)\baccidentes? (de transporte|de coche|de carro|automovilisticos?)\b(?! en vehiculos)/, '$2accidente de transporte en vehiculos con motor'],
  [/\b(golpes? de calor|insolacion)\b/g, 'efectos del calor y de la luz'],
  [/\b(intoxicacion(es)? (por|con) (comida|alimentos)|intoxicacion alimentaria|comida en mal estado)\b/g, 'intoxicacion alimentaria bacteriana'],
  [/\b(\d{4}) (vs|versus|contra) (\d{4})\b/g, 'este ano'],
  [/\b(este ano )?(vs|versus|contra|comparado con) (el )?ano pasado\b|\beste ano (vs|versus|contra|comparado con) el pasado\b/g, 'este ano'],
];
const NOTA_GRIPA = /\b(gripa|gripe|resfriado|catarro)\b/;
const MOSQUITO = /\b(mosquito|mosquitos|moscos|zancudo|zancudos)\b/;
const ABREVIATURAS = [
  ['nuevo leon', /\bnl\b/], ['estado de mexico', /\b(edomex|edo mex|edo de mex|edo\. mex)\b/], ['ciudad de mexico', /\b(cdmx|df|d f)\b/],
  ['baja california sur', /\bbcs\b/], ['baja california', /\bbc\b/], ['quintana roo', /\b(qroo|q roo)\b/], ['san luis potosi', /\bslp\b/],
  ['guanajuato', /\bgto\b/], ['chihuahua', /\bchih\b/], ['tamaulipas', /\btamps\b/], ['yucatan', /\byuc\b/], ['jalisco', /\bjal\b/],
  ['michoacan', /\bmich\b/], ['oaxaca', /\boax\b/], ['queretaro', /\bqro\b/], ['coahuila', /\bcoah\b/], ['durango', /\bdgo\b/],
  ['zacatecas', /\bzac\b/], ['aguascalientes', /\bags\b/], ['chiapas', /\bchis\b/], ['guerrero', /\bgro\b/], ['hidalgo', /\bhgo\b/],
  ['nayarit', /\bnay\b/], ['tlaxcala', /\btlax\b/], ['campeche', /\bcamp\b/],
];
/** Reescribe sinónimos, abreviaturas y ciudades. Devuelve el texto y las notas que la respuesta debe decir. */
export function reescribeConsulta(raw) {
  const base = ciudadesAEstados(raw);
  let t = base.notas.length ? base.texto : norm0(raw);
  const antes = t;
  const notas = [...base.notas.map((n) => `${n.ciudad} está en ${n.estado}: el boletín da los datos por estado, así que te respondo para ${n.estado}`)];
  if (/\b(bronquiolitis|virus sincitial|vsr)\b/.test(t)) notas.push('La bronquiolitis y el virus sincitial no se reportan aparte: se cuentan dentro de las infecciones respiratorias agudas');
  if (NOTA_GRIPA.test(t)) notas.push('Por «gripa» entiendo infecciones respiratorias agudas (resfriado, faringitis y similares); la influenza se notifica aparte y no tiene pronóstico');
  // Abreviaturas de chat: «q» → «que», «xq» → «por que», «tmb» → «también».
  t = t.replace(/\bq\b/g, 'que').replace(/\b(xq|pq|porq)\b/g, 'por que').replace(/\b(tmb|tb)\b/g, 'tambien').replace(/\bk\b/g, 'que')
    .replace(/\bd\b/g, 'de').replace(/\bx\b(?! ?\d)/g, 'por').replace(/\b(plis|pls|porfis|xfa|xfavor|xd|jaja\w*|jeje\w*|ntp|alv|wey|we|neta)\b/g, ' ').replace(/\btodo mx\b|\ben mx\b/g, 'nacional');
  // «en México» a secas es el país; el Estado de México se nombra completo («Estado de México», «Edomex»).
  const conPais = t.replace(/(^|[^a-z])((?:en|para|todo|toda|de|del) )mexico\b/g, (m, pre, prep, off, str) =>
    (/\b(estado|edo|ciudad|valle|gobierno|universidad|nuevo) $/.test(str.slice(0, off + pre.length)) ? m : `${pre}${prep === 'de ' || prep === 'del ' ? 'a nivel ' : prep}nacional`));
  if (conPais !== t) {
    t = conPais;
    notas.push('Tomo «México» como todo el país; si te refieres al Estado de México, escribe «Estado de México» o «Edomex»');
  }
  for (const [re, rep] of SINONIMOS) t = t.replace(re, rep);
  for (const [estado, re] of ABREVIATURAS) t = t.replace(re, estado);
  if (MOSQUITO.test(t) && !/\b(dengue|chikungunya|zika|paludismo|malaria)\b/.test(t)) {
    t = t.replace(MOSQUITO, 'dengue');
    notas.push('Por «mosquito» entiendo dengue; también puedes preguntarme por chikungunya o paludismo');
  }
  return t === antes && !base.notas.length ? { texto: raw, notas } : { texto: t, notas };
}

// ── Un estado sin padecimiento: lo que más sube y lo que más casos tendrá ahí ─────────────────────────────────────────
const SOLO_ESTADO = /^(?:y )?(?:como (?:va|esta|anda|vamos)|que (?:hay|pasa|onda|tal)|que (?:esta|va) (?:subiendo|al alza|pegando)|que pega|que enfermedades hay|enfermedades|salud|casos)?\b/;
const NO_TRANSMISIBLE = /tumor|cancer|isquemica|hipertension|diabetes|obesidad|desnutricion|insuficiencia|hiperplasia|displasia|asma|depresion|alzheimer|parkinson|intoxicacion|accidente|mordedura|quemadura|cerebrovascular|anorexia|bocio|calor|hipotermia|violencia|peaton|vehiculo|herida|edema|proteinuria|alcohol|ulceras|gingivitis|ahogamiento|picadura|alacran|abeja|arana|serpiente|artropodo|ponzono|esavi|vacunacion|anencefalia|embarazo/;
export function answerEstadoLlano(q, ent, s, d, { forzar = false, transmisibles = false } = {}) {
  if (!ent.estado || ent.padecimiento || (ent.padecimientos || []).length) return null;
  const palabras = q.split(' ').filter(Boolean).length;
  const pideRanking = RANKING.test(q) || /\b(subiendo|al alza|pegando|que hay|como (va|esta|anda)|creciendo|aumentando|siguen (creciendo|subiendo|aumentando)|mas comunes|mas frecuentes|lista de (las )?enfermedades)\b/.test(q);
  if (!(pideRanking || palabras <= 4 || forzar)) return null;
  if (/\b(motor|modelo|modelos|smape|mase|metrica|validacion|equipo|zoom|mapa|semaforo|timelapse|comparar|compara|vs)\b/.test(q)) return null;
  const res = d?.resumen_padecimientos;
  if (!res || (!forzar && !SOLO_ESTADO.test(q))) return null;
  const est = ESTADOS_NOMBRE[norm0(ent.estado).replace(/^mexico$/, 'estado de mexico')] || ent.estado;
  const clave = est === 'Estado de México' ? 'México' : est;
  const filas = res.padecimientos.map((x) => ({ x, e: x.estados?.[clave] })).filter((y) => y.e)
    .filter((y) => !transmisibles || !NO_TRANSMISIBLE.test(y.x.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));
  if (!filas.length) return null;
  const suben = filas.filter((y) => y.e[2] === 'sube' && Math.max(y.e[0], y.e[1]) >= 20)
    .sort((a, b) => (b.e[1] / Math.max(1, b.e[0])) - (a.e[1] / Math.max(1, a.e[0]))).slice(0, 5);
  const mas = [...filas].sort((a, b) => b.e[1] - a.e[1]).slice(0, 5);
  const pct = (y) => (y.e[0] > 0 ? ` (${Math.round((y.e[1] / y.e[0] - 1) * 100)} % más que en las 4 anteriores)` : '');
  const lineas = [`**${est}: lo que se espera en las próximas 4 semanas${transmisibles ? ' (enfermedades transmisibles)' : ''}**`, ''];
  lineas.push(suben.length ? '**Lo que más se espera que suba:**' : 'Ningún padecimiento con al menos 20 casos muestra un aumento claro ahí.', '');
  lineas.push(...suben.map((y) => `- **${y.x.nombre}**: unos ${ent0(y.e[1])} casos${pct(y)}${y.x.confiabilidad === 'baja' ? ' · _confiabilidad baja_' : ''}.`));
  lineas.push('', '**Los que tendrán más casos:**', '', ...mas.map((y) => `- **${y.x.nombre}**: unos ${ent0(y.e[1])} casos.`));
  lineas.push('', `Pregúntame por uno en particular («¿cómo va ${mas[0].x.consulta} en ${est}?») o por dengue, depresión, Parkinson o Alzheimer, que se publican aparte. Datos hasta la semana del ${fecha(res.corte)}; no incluye temas sensibles.`, '<!--SIN_GRAFICA-->');
  const sig = [...suben, ...mas].slice(0, 3).map((y) => ({ t: `${y.x.nombre} en ${est}`, q: `¿cómo va ${y.x.consulta} en ${est}?` }));
  return lineas.join('\n') + sigue(sig);
}

// ── Quejas: disculpa breve y opciones concretas ───────────────────────────────────────────────────────────────────────
const QUEJA = /\b(no sirves|no sirve|eres inutil|inutil|no entiendes|no me entiendes|no me ayudas|pesimo|malisimo|que mal|eres malo|eres tonto|bot tonto|no funciona|no funcionas|no contestas|no respondes|ya me harte de ti|peor que siri|peor que alexa|no entiendo nada|habla claro|no le entiendo|no se te entiende|no me contestas|no me respondes|contestas mal|respondes mal|responde bien|contesta bien|me dio datos de otro|datos de otro lado|que clase de bot|no sirve este bot)\b/;
export function answerQueja(q, ent) {
  if (!QUEJA.test(q) || ent.padecimiento || ent.estado) return null;
  return 'Lamento no haberte ayudado. Dime con tus palabras qué buscas y lo intento de nuevo; por ejemplo, el padecimiento y el ' +
    'estado («dengue en Veracruz»), si algo está subiendo o qué tan confiable es un pronóstico.\n<!--SIN_GRAFICA-->' + sigue(EJEMPLOS);
}

// ── Preguntas frecuentes de alcance y método (respuestas fijas, verificables en el propio sitio) ─────────────────────────
const FAQ = [
  [/\b(por edad|edades|grupo de edad|grupos de edad|rango de edad|en ninos|en ninas|los ninos|las ninas|a los ninos|en bebes|adultos mayores|ancianos|en jovenes|adolescentes|tercera edad|les da a los ninos)\b/,
    'El boletín epidemiológico, y por eso EpiForecast-MX, reporta los casos **por estado y por sexo, no por edad**. No puedo separar niños, jóvenes o adultos mayores; sí puedo darte el total de un padecimiento en tu estado, o hombres y mujeres por separado.'],
  [/\b(municipio|municipios|jurisdiccion|jurisdicciones|unidad medica|umf|por hospital|por clinica|colonia|colonias|localidad|alcaldia|alcaldias|ciudad por ciudad|por ciudad|entre ciudades)\b/,
    'Los datos llegan **sólo hasta el nivel de estado** (32 entidades, cuatro macrorregiones y el total nacional), por sexo. El boletín semanal no publica municipios, jurisdicciones ni unidades médicas. Si me dices tu ciudad, te respondo para su estado.'],
  [/\b(defunciones|muertes|mortalidad|letalidad|cuantos murieron|fallecidos|fallecimientos)\b/,
    'No. El boletín semanal reporta **casos nuevos notificados**, no defunciones, así que no hay mortalidad ni letalidad en EpiForecast-MX.'],
  [/\b(por 100 ?mil|por cien mil|tasa de incidencia|tasas de incidencia|incidencia por|tasa por|denominador|ajustad[oa]s? por poblacion|conapo|per capita)\b/,
    'Trabajo con **casos notificados**, no con tasas por 100 mil habitantes: no ajusto por población. Cuando comparo estados lo aclaro («sin ajustar por población»), porque un estado más poblado tendrá más casos aunque su riesgo no sea mayor.'],
  [/\b(oficial|oficiales|secretaria de salud|de donde (salen|vienen|sacan) (los )?datos|imss bienestar|issste|instituciones|solo imss|sector privado|privados)\b/,
    'Los datos vienen del **Boletín Epidemiológico** de la Dirección General de Epidemiología (Sistema Nacional de Vigilancia Epidemiológica), que reúne las notificaciones de las instituciones del Sistema Nacional de Salud, no sólo del IMSS. Los **pronósticos** son de EpiForecast-MX, un proyecto académico: no son cifras oficiales de la Secretaría de Salud.'],
  [/\b(confirmados|probables|sospechosos|notificados vs|casos notificados|confirmacion|laboratorio)\b/,
    'Son **casos nuevos notificados** cada semana al sistema de vigilancia, con la definición de caso de cada padecimiento. En la mayoría no implica confirmación por laboratorio, y no todos los enfermos llegan a diagnosticarse o reportarse.'],
  [/\b(preliminar|preliminares|definitivas|definitivos|se corrigen|correcciones|rezago|retraso|distinto al (que trae el )?boletin|no coincide|no cuadra|dice una cifra|cifra distinta|otra cifra|diferente al boletin|ustedes otra|si ya vamos|ya vamos en la|por que dice semana)\b/,
    'Las cifras de las semanas más recientes son **preliminares**: el boletín puede corregir los acumulados en semanas siguientes. Por eso cada respuesta dice hasta qué semana llegan los datos, y una caída brusca en las últimas semanas se marca como posible retraso de notificación, no como una baja real.'],
  [/\b(cada cuando|que tan seguido|cada semana|actualizan|actualiza|actualizacion|proxima actualizacion|cuando publican|cuando sale|cuando se actualiza)\b/,
    'Se actualiza **cada semana**, cuando la Secretaría de Salud publica un boletín nuevo (suele salir con una o dos semanas de rezago). Los pronósticos se emiten una vez y después se comparan, semana a semana, con lo que va llegando.'],
  [/\b(descargar|descarga|excel|csv|datos abiertos|bajar los datos|api)\b/,
    'Cada padecimiento tiene su página con gráfica interactiva en la [galería de pronósticos](../Reports/index.html), y el [radar del boletín](../boletin.html) permite descargar las cifras en CSV.'],
  [/\b(canal endemico|corredor endemico|umbral epidemico|alerta epidemiologica)\b/,
    'No tengo canal endémico. Para saber si algo está alto, comparo las últimas 4 semanas con las mismas semanas del año anterior y digo si se espera que suba, baje o se mantenga.'],
  [/\b(control estacional|naive estacional|lag 52|no validado|que significa no validado|control only|control_only|mismo ano copiado|ano copiado|copian el ano|copia del ano)\b/,
    'Un **control estacional** es el pronóstico más simple: repetir lo que pasó la misma semana del año anterior. A cada padecimiento se le prueban varios modelos; si ninguno lo supera en una prueba con datos que no vio, se publica el control y lo marco con **confiabilidad baja**, porque no es un modelo validado.'],
  [/\b(inteligencia artificial|machine learning|aprendizaje automatico|redes neuronales|usan ia|usas ia|es ia)\b/,
    'Sí: para cada padecimiento se prueban métodos estadísticos y de aprendizaje automático, y se elige el que mejor predijo años que no vio. Si ninguno supera al control estacional (repetir el año anterior), se publica ese control con confiabilidad baja. No uso inteligencia artificial para inventar cifras: todos los números salen de los datos publicados.'],
  [/\b(53 semanas|semana 53|sem -1|sem menos 1|sem 1 que aparece|la sem 1|ano mmwr|semanas mmwr)\b/,
    'El calendario epidemiológico divide el año en semanas de domingo a sábado; algunos años tienen 53 semanas (2020 y 2025, por ejemplo). Cuando comparo con el año anterior uso las mismas semanas del calendario.'],
  [/\b(citar|citarlos|citarte|como los cito|como lo cito|referencia para)\b/,
    'Puedes citarlo como **EpiForecast-MX** (https://epiforecast.mx), un proyecto académico de la Maestría en Inteligencia Artificial Aplicada del Tecnológico de Monterrey, con datos del Boletín Epidemiológico de la Secretaría de Salud. Aclara que los pronósticos no son cifras oficiales y anota la semana de corte que aparece en cada respuesta.'],
  [/\b(cuantos padecimientos|que padecimientos (tienen|hay|monitorean|cubren)|cuales padecimientos|lista de padecimientos|lista completa|el listado|la lista de|que enfermedades (tienen|hay|cubren|monitorean)|cuales no tienen pronostico|cuales tienen pronostico)\b/,
    () => `Tengo pronóstico de **${TOTAL_PUBLICADOS()} padecimientos** del boletín epidemiológico (todos están en la [galería](../Reports/index.html)). Otras categorías del boletín no tienen pronóstico, porque tienen muy pocos casos o datos insuficientes; sus cifras impresas están en el [radar del boletín](../boletin.html).`],
  [/\b(que es epiforecast|que es epiforecast mx|que es este sitio|que es esta pagina|de que se trata esto)\b/,
    () => `**EpiForecast-MX** es un proyecto académico que pronostica cada semana los casos notificados de ${TOTAL_PUBLICADOS()} padecimientos en México, por estado y por sexo, con los datos del Boletín Epidemiológico de la Secretaría de Salud. Cada pronóstico se compara con lo que va llegando y lleva su nivel de confiabilidad. No son cifras oficiales.`],
  [/\b(intervalo|intervalos|rango de error|margen de error|incertidumbre|intervalo de confianza|intervalos de prediccion|al 95|al 80)\b/,
    'No: son **pronósticos puntuales, sin intervalos** de predicción. Por eso cada respuesta dice qué tan confiable es el pronóstico y cuánto se ha desviado en las semanas ya comprobadas.'],
  [/\bsmape (de|del|en|igual a|=)? ?\d+/,
    'El **sMAPE** mide el error porcentual promedio entre lo pronosticado y lo observado (0 % sería perfecto). Como guía práctica: menos de 20 % es bueno, de 20 a 50 % es moderado y más de 50 % es alto; en series con muy pocos casos el sMAPE se dispara aunque el error en casos sea pequeño. Por eso en cada respuesta doy la confiabilidad en palabras.'],
  [/\b(eres (un )?(doctor|medico|maquina|robot|chatgpt|gemini)|es una maquina|es usted doctor|usted es doctor|eres chatgpt)\b/,
    'Soy **EPI**, un asistente automático: no soy una persona ni un médico. Las cifras salen siempre de los datos publicados del boletín epidemiológico; para preguntas abiertas me apoyo en un modelo de lenguaje (Gemini de Google), pero nunca para inventar números.'],
  [/\b(quien paga|quien lo paga|lo hizo el imss|es del imss|es del gobierno|4t|marketing|propaganda|lo recomienda la sep|avalado|patrocin\w*)\b/,
    'EpiForecast-MX es un **proyecto académico** de la Maestría en Inteligencia Artificial Aplicada del Tecnológico de Monterrey, hecho para la salud pública en México. No es un producto del gobierno ni de un partido, y no está avalado por la Secretaría de Salud ni por la SEP. Los datos son los del boletín oficial; los pronósticos son del proyecto.'],
  [/\b(mis datos|datos personales|que guardan|guardan lo que|vendieron|privacidad|me espian|rastrean)\b/,
    'No te pido datos personales. Cuando una pregunta necesita el modelo de lenguaje, su texto se envía a Google Gemini para generar la respuesta, así que no escribas nombres, teléfonos ni datos que te identifiquen.'],
  [/\b(quien se hace responsable|quien es responsable|me equivoco por sus|si me equivoco|responsabilidad)\b/,
    'Es información estadística orientativa: no es consejo médico ni una cifra oficial. Cada respuesta dice qué tan confiable es el pronóstico; para decisiones de salud o de servicios, contrástalo con tu médico o con la información de tu jurisdicción.'],
  [/\b(inventan|inventados|inventadas|son reales los|numeros falsos|datos falsos)\b/,
    'No se inventan: los casos observados son exactamente los que imprime el boletín epidemiológico, estado por estado, y los pronósticos se calculan con la serie de cada estado. En estados con pocos casos te lo digo («hay muy pocos casos») y no hablo de tendencias.'],
  [/\b(como (validan|prueban|evaluan|saben que sirve)|backtesting|validacion cruzada|como se valida)\b/,
    'Cada pronóstico se prueba con un año que el modelo **no vio** (2025 en la mayoría) contra el control estacional, que repite el año anterior; si no lo supera, se publica ese control y lo marco con confiabilidad baja. Después, cada semana se compara con lo que llega en el boletín.'],
  [/\b(pronostico nacional|total nacional|el nacional se calcula|sumando estados|suma de los estados)\b/,
    'En 148 padecimientos el total nacional es la **suma de los pronósticos por estado y sexo**. En dengue, depresión, Parkinson y Alzheimer el nacional tiene su propio modelo, así que puede no coincidir exactamente con la suma de los estados.'],
  [/\b(para que sirve esto|de que sirve|para que sirves si|usar sus graficas|usar sus datos|usar la informacion)\b/,
    'Sirve para ver de un vistazo cómo van los casos de un padecimiento en tu estado, si se espera que suban o bajen y qué tan confiable es esa expectativa, con datos oficiales. Puedes usar las gráficas y cifras citando a EpiForecast-MX y al Boletín Epidemiológico, aclarando que los pronósticos no son cifras oficiales.'],
  [/\b(entrevista|entrevistarte|voz experta|para mi programa|para el segmento)\b/,
    'Soy un asistente automático y no doy entrevistas. Puedes citar las cifras de EpiForecast-MX con su semana de corte y la fuente (Boletín Epidemiológico de la Secretaría de Salud), aclarando que los pronósticos no son cifras oficiales.'],
  [/\bestado (3[3-9]|[4-9]\d)\b/,
    'México tiene **32 entidades federativas**; no existe un estado con ese número. Dime el nombre del estado y te digo cómo va.'],
  [/\b(0 ?punto ?\d|0\.\d|medio enfermo|medios enfermos|casos con decimales|decimales)\b/,
    'Los pronósticos son **promedios esperados**, por eso pueden tener decimales: «0.4 casos por semana» quiere decir que en unas cinco semanas se esperan unos dos casos. En las respuestas redondeo y, con muy pocos casos, no hablo de tendencias.'],
  [/\b(datos de manana|de manana|datos de hoy|por dia|diarios|diario)\b/,
    'Los datos son **semanales**: el boletín reporta los casos de cada semana epidemiológica, no por día. Puedo decirte la última semana con datos y lo que se espera en las próximas.'],
  [/\b(alerta sanitaria|alertas sanitarias|alerta epidemiologica vigente|emergencia sanitaria)\b/,
    'No emito alertas sanitarias: las oficiales las publica la Secretaría de Salud federal o la de tu estado. Sí puedo decirte qué padecimientos están subiendo en un estado.'],
  [/\b(son actuales|son actualizados|estan actualizad\w*|que tan (segura|seguro|confiable|cierta) (es|puedo)|es cierta|son ciertos|como (la|los) obtienes|de donde (la|los) sacas|como se cuenta|como cuentan|como se cuentan|te creen los medicos|que tan seguro es este)\b/,
    () => 'Los casos vienen del **Boletín Epidemiológico** de la Secretaría de Salud, que reúne las notificaciones semanales de las instituciones de salud; se actualizan cada semana y cada respuesta dice hasta qué semana llegan. Los pronósticos son del proyecto y cada uno trae su confiabilidad (alta, media o baja) explicada; no son cifras oficiales.'],
  [/\b(sabes quien soy|saber quien soy|me conoces|sabes mi nombre)\b/,
    'No sé quién eres: no pido ni guardo datos personales, y no puedo saber si alguien tiene un padecimiento. Sólo trabajo con cifras agregadas por estado y sexo.'],
  [/\b(usan tu sistema|usan este sistema|quien usa|quienes usan|lo usan los medicos|lo usa el imss)\b/,
    'EpiForecast-MX es un proyecto académico de acceso público; no está integrado oficialmente en los sistemas de ninguna institución de salud. Cualquiera puede consultarlo, citando la fuente y la semana de corte.'],
  [/\b(campanas|campana de|prevencion en las escuelas|para crear campanas|para concientizar)\b/,
    'Sí pueden servir como referencia: muestran qué padecimientos tienen más casos o van al alza en tu estado y cuándo suelen tener su pico. Revisa la confiabilidad de cada pronóstico y combina la información con la de tu jurisdicción sanitaria.'],
  [/\b(sirven para planear|para pedir medicamento|para planear|para la planeacion|toma de decisiones|puedo usar estos pronosticos)\b/,
    'Son una referencia orientativa, no oficial: sirven para ver tendencias y comparar con años anteriores, siempre revisando la confiabilidad que acompaña a cada pronóstico. Para decisiones de abasto o de servicios, contrástalos con la información de tu jurisdicción.'],
  [/\b(clasifica\w*|separa\w*|divide\w*|distingue\w*) .*\bsexo\b|\bsexo\b.* (clasifica\w*|separa\w*)\b/,
    'El boletín reporta cada caso como de un hombre o de una mujer, por estado. Por eso cada padecimiento tiene tres series: hombres, mujeres y el total; algunos (como los cánceres propios de un sexo) sólo el total. No hay otras categorías ni datos por edad.'],
  [/\b(como (se )?(calculan|hacen|sacan|obtienen|generan|predice\w*|funcionan) (los |sus |tus |estos )?pronosticos|como (puede|puedes|pueden) (el chatbot )?predecir|como predice\w*|que investigacion se (realiza|hace)|como se actualizan (los |estos )?pronosticos|pronosticos? .*\bcomo se (calculan|hacen|sacan)|como se mide la confiabilidad)\b/,
    'Para cada padecimiento y estado, un modelo estadístico aprende de los casos de las semanas pasadas (la temporada del año, la tendencia) y proyecta las siguientes. Probamos varios modelos y nos quedamos con el que mejor acertó en semanas que no había visto; cada semana, al salir el boletín, se compara lo que se esperaba con lo que llegó. Por eso cada pronóstico trae su confiabilidad (alta, media o baja).'],
  [/\bcomo funciona(n)? (el |este |tu |su |la )?(chatbot|bot|epibot|sistema|asistente|pagina|sitio)\b/,
    () => `Leo cada semana el Boletín Epidemiológico de la Secretaría de Salud, que trae los casos nuevos notificados de ${TOTAL_PUBLICADOS()} padecimientos por estado y por sexo. Con esa historia, un modelo estadístico proyecta las semanas siguientes. Cuando me preguntas, busco el padecimiento y el lugar y te digo cuántos casos hubo, qué se espera y qué tan confiable es el pronóstico.`],
  [/\b(subregistro|no todos (van|acuden) al medico|gente que no va al medico|no se reportan todos|casos no reportados|como saben cuantos casos)\b/,
    'Tienes razón: el boletín cuenta los casos que se diagnostican y se notifican, no a todas las personas enfermas; quien no va al médico no aparece. Por eso hablo de **casos notificados**. Sirven para ver tendencias y comparar semanas o años, no para saber cuántas personas tienen la enfermedad en realidad.'],
  [/\b(puedo (hacer|hacerte|preguntar|preguntarte) (una |otra )?(pregunta|algo)|puedo preguntar(te)?)\b/,
    'Claro. Pregúntame por un padecimiento y, si quieres, un estado o el sexo: por ejemplo, «¿cómo va la varicela en Sonora?» o «¿qué enfermedades van al alza en Jalisco?».'],
  [/\b(donde (puedo )?(encontrar|encuentro|uso|usar) (este|el|al) (chatbot|bot|asistente)|es gratis|es gratuito|cuesta|tiene costo|hay que pagar)\b/,
    'Es gratuito y no pide registro: está en **epiforecast.mx/epibot** y funciona en el celular y en la computadora.'],
  [/\b(llamadas|llamar por telefono|telefono de atencion|horario de atencion|horas (son )?de (su )?atencion|que horario|whatsapp|atienden por telefono)\b/,
    'Sólo respondo por mensajes escritos aquí, a cualquier hora del día. No hay atención telefónica ni personal; ante una urgencia llama al **911**.'],
  [/\b(que (tipo de |clase de )?datos (tienes|tiene|manejas|maneja|hay|usas|usa)|solo (datos )?epidemiologicos|que informacion (tienes|tiene|manejas))\b/,
    () => `Tengo los **casos nuevos notificados cada semana** al Boletín Epidemiológico de la Secretaría de Salud, por estado y por sexo, para ${TOTAL_PUBLICADOS()} padecimientos, y un pronóstico para cada uno. No tengo datos por edad ni por municipio, defunciones ni expedientes de pacientes.`],
  [/\b(comparar (el numero de )?casos|comparar (entre )?(estados|padecimientos)|como (se puede|puedo) comparar|datos (de manera )?mas detallad\w*|mas detalle de los datos|descargar los datos|bajar los datos)\b/,
    'Pídemelo directo: por ejemplo, «dengue en Jalisco vs Veracruz» o «diabetes en Sonora mujeres». La página de cada padecimiento en epiforecast.mx muestra la serie semanal completa por estado y sexo.'],
  [/\b((proporcionarte|darte|decirte|compartirte) (mi|mis) (edad|peso|estatura|datos|informacion)|recomendaciones (especificas|personales|personalizadas))\b/,
    'No necesito tus datos personales y no doy recomendaciones médicas personalizadas: para eso, tu médico o tu centro de salud. Lo que sí puedo es decirte cómo van los padecimientos en tu estado, también por sexo.'],
  [/\b(dieta saludable|comer sano|mantener(me)? (una )?(buena )?salud|mantener(me)? saludable|mantener (la|una|tu|mi|su) (buena )?salud|rutina de ejercicio|hacer ejercicio|estar (mas )?sano|consejos? (de|para) (la )?salud|proteger a mis hij\w*|protegerlos|como (puedo )?saber si tengo algo|algo no esta bien en mi cuerpo|me siento raro|mejorar (mi|su) salud|ayudar a la gente a mejorar)\b/,
    'Para eso lo mejor es tu médico o tu centro de salud (en el IMSS, tu Unidad de Medicina Familiar); yo no doy orientación médica. Lo que sí puedo es decirte qué padecimientos van al alza en tu estado, para saber de qué cuidarte: por ejemplo, «¿qué enfermedades van al alza en Jalisco?».'],
];
export function answerFAQ(q, ent) {
  const conPad = ent.padecimiento || (ent.padecimientos || []).length;
  for (const [re, txt] of FAQ) {
    if (!re.test(q)) continue;
    // El resumen del radar responde las preguntas sobre las categorías del boletín.
    if (/\b(boletin|radar|modelables?)\b/.test(q) && /padecimientos|categorias|enfermedades/.test(String(re))) continue;
    // Con un padecimiento nombrado, sólo las preguntas de alcance que no tienen dato (edad, municipio, muertes, tasas).
    // Con un padecimiento nombrado sólo municipios, muertes y tasas (la edad la responde answerEdadNoDisponible).
    if (conPad && ![FAQ[1][0], FAQ[2][0], FAQ[3][0]].includes(re)) continue;
    const t = typeof txt === 'function' ? txt() : txt;
    const extra = conPad ? `\n\nSi quieres, te doy el total de ${String(ent.padecimiento || '').toLowerCase() || 'ese padecimiento'}${ent.estado ? ` en ${ent.estado}` : ''}.` : '';
    return `${t}${extra}\n<!--SIN_GRAFICA-->`;
  }
  return null;
}

// ── Fuera de alcance: lugares, horarios, medicamentos, política, deportes, dinero ──────────────────────────────────────
const FUERA = [
  [/\b(cita|citas|agendar|sacar ficha|ficha para)\b.*\b(seguro|imss|issste|clinica|doctor|medico|centro de salud)\b|\b(dar|darme|sacar|agendar) (la |una )?cita\b/,
    'No agendo citas. Para una cita usa la aplicación o el teléfono de tu institución (por ejemplo, IMSS Digital) o acude a tu unidad de salud.'],
  [/\b(vacunas? (necesito|para viajar|para ir)|agua de la llave|que precauciones|hotel|hoteles|donde hospedarme)\b/,
    'No doy recomendaciones de viaje, de vacunas ni de hospedaje: consulta a tu médico o a los servicios de salud de tu estado. Sí puedo decirte cómo van los casos de un padecimiento en el estado al que vas.'],
  [/\b(hacer mi tarea|hazme la tarea|haz mi tarea|resolver mi tarea)\b/,
    'No hago tareas, pero puedo darte datos para la tuya: casos y tendencias de un padecimiento por estado, con su fuente.'],
  [/\b(accion|acciones|bolsa de valores|cotiza|cotizacion)\b/,
    () => `Eso no lo sé: sólo hablo de cómo van ${TOTAL_PUBLICADOS()} padecimientos en México.`],
  [/\b(mejor hospital|hospitales? (de|en)|clinica (de|en))\b/,
    'No tengo un directorio de hospitales ni hago recomendaciones de unidades. En una urgencia llama al **911**.'],
  [/\b(recomiendas un (doctor|medico)|un doctor en|un medico en|buen doctor|buen medico|hospital mas cercano|clinica mas cercana|a que hora abre|horario|donde queda|direccion del|telefono del|centro de salud mas cercano|farmacia)\b/,
    'No tengo un directorio de hospitales ni de centros de salud. En una urgencia llama al **911**; para ubicar tu unidad, consulta la página de tu institución (IMSS, ISSSTE o la Secretaría de Salud de tu estado).'],
  [/\b(paracetamol|ibuprofeno|aspirina|antibiotico|antibioticos|vaporub|remedio|remedios|que medicina|que medicamento|que le doy|que me tomo|dosis|jarabe|te de)\b/,
    'No recomiendo medicamentos ni remedios: consulta a tu médico o a tu farmacéutico. Si hay datos de alarma (fiebre muy alta, dificultad para respirar, sangrado, deshidratación), acude a urgencias o llama al **911**.'],
  [/\b(presupuesto|recorte|gobierno|presidente|presidenta|secretario de salud|politica|partido politico|elecciones|opinas|que opina)\b/,
    'No opino de política ni de decisiones de gobierno: sólo doy datos de casos notificados y sus pronósticos.'],
  [/\b(america|chivas|pumas|cruz azul|partido|gano|beisbol|dolar|tipo de cambio|tortas|pozole|comida favorita|te gusta la comida|te gustan las)\b/,
    () => `Soy **EPI** y no respondo temas fuera del proyecto: sólo hablo de cómo van ${TOTAL_PUBLICADOS()} padecimientos en México. Pregúntame, por ejemplo, «¿cómo va el dengue en Veracruz?».`],
  [/\b(mas sano para vivir|mejor estado para vivir|donde vivir|estado mas sano|mas saludable|estado mas saludable)\b/,
    'No hago esa recomendación: los casos notificados dependen de la población y de cuánto se diagnostica en cada estado. Sí puedo decirte cómo va un padecimiento en un estado o qué está subiendo ahí.'],
];
export function answerFueraDeAlcance(q, ent) {
  // Con un padecimiento nombrado, la pregunta de tratamiento sigue la ruta médica con aviso (RAG), no esta respuesta fija.
  if (ent.padecimiento || (ent.padecimientos || []).length) return null;
  for (const [re, txt] of FUERA) {
    if (!re.test(q)) continue;
    // «¿cómo se mide la confiabilidad de los datos del gobierno?» es una pregunta sobre los datos, no de política.
    if (/\bgobierno\b/.test(String(re)) && /\b(confiab\w*|datos|cifras|boletin)\b/.test(q)) continue;
    return `${typeof txt === 'function' ? txt() : txt}\n<!--SIN_GRAFICA-->`;
  }
  return null;
}

// ── Lo que el boletín no reporta como categoría propia ──────────────────────────────────────────────────────────────────
const NO_REPORTADOS = [
  [/^(?!.*\b(cancer|tumor)\b).*\b(tiroides|hipotiroidismo|hipertiroidismo)\b/, 'El boletín epidemiológico **no reporta las enfermedades de la tiroides** en general; sólo el **bocio endémico**, que sí tiene pronóstico. Pregúntame «¿cómo va el bocio endémico?» si te interesa.'],
  [/\b(mano pie (y )?boca|mano, pie y boca|coxsackie)\b/, 'El boletín epidemiológico **no reporta por separado la enfermedad de mano, pie y boca**, así que no tengo datos de casos. Si un niño tiene fiebre que no baja, no quiere tomar líquidos o se ve muy decaído, acude a revisión.'],
  [/\b(piojos|liendres|pediculosis)\b/, 'El boletín epidemiológico **no reporta la pediculosis (piojos)**, así que no tengo datos de casos. Para orientación, consulta a tu médico o a la escuela; no requiere aislamiento ni es una enfermedad de notificación semanal.'],
];
export function answerNoReportado(q) {
  for (const [re, t] of NO_REPORTADOS) if (re.test(q)) return `${t}\n<!--SIN_GRAFICA-->`;
  return null;
}

// ── Turno vago («casos», «y qué», «ok») ──────────────────────────────────────────────────────────────────────────────────
export function answerVago(q, ent) {
  if (ent.padecimiento || ent.estado || (ent.padecimientos || []).length) return null;
  if (/^(ok|okey|okay|va|vale|sale|dale|listo|perfecto|entendido|bien|bueno|aja|si|claro|de acuerdo|esta bien)$/.test(q)) {
    return '¿Qué más quieres revisar? Puedo decirte cómo va un padecimiento en tu estado o qué está subiendo en el país.\n<!--SIN_GRAFICA-->' + sigue(EJEMPLOS.slice(0, 3));
  }
  if (/^(casos|datos|y que|y|que|info|informacion|pronostico|pronosticos|enfermedades|padecimientos|cifras|numeros|cuantos|cuantas|y eso que|mmm y eso que|y eso|de eso que te dije|de eso|eso)$/.test(q.replace(/^(mmm+|eh+|ah+|oye) /, ''))) {
    return '¿De qué padecimiento o estado? Por ejemplo: «dengue en Veracruz», «¿qué enfermedades van al alza?» o «diabetes en Nuevo León».\n<!--SIN_GRAFICA-->' + sigue(EJEMPLOS);
  }
  return null;
}

// ── Semana que todavía no tiene boletín («datos de la semana 45») ───────────────────────────────────────────────────────
export function answerSemanaFutura(q, ent, s, d) {
  const m = q.match(/\bsemana (\d{1,2})\b/);
  const meta = d?.radar_boletin?.meta;
  if (!m || !meta || ent.padecimiento) return null;
  const n = Number(m[1]);
  if (n <= meta.week || n > 53) return null;
  return `La semana ${n} todavía no tiene boletín publicado. El más reciente llega hasta la **semana ${meta.week} de ${meta.year}** ` +
    `(${meta.period}) y se publicó el ${meta.publication}; el boletín suele salir con dos o tres semanas de rezago.\n<!--SIN_GRAFICA-->`;
}
/** Línea sobre el último boletín (para «¿en qué semana estamos?»), desde la foto del radar. */
export function lineaUltimoBoletin(d) {
  const meta = d?.radar_boletin?.meta;
  return meta ? `El boletín más reciente llega hasta la **semana ${meta.week} de ${meta.year}** (${meta.period}) y se publicó el ${meta.publication}.` : null;
}

// ── Viajes y escuelas: «¿conviene ir a Acapulco?», «¿hay brotes de algo en Mérida?» → resumen del estado ─────────────────
const VIAJE = /\b(ir a|viajo|viajar|vamos a|voy a|vacaciones|conviene ir|es seguro ir|hay brotes? de algo|que enfermedades hay|que hay de enfermedades|que anda|algo raro)\b/;
export function answerViaje(q, ent, s, d) {
  if (!ent.estado || ent.padecimiento || (ent.padecimientos || []).length || !(VIAJE.test(q) || /\balerta\b/.test(q))) return null;
  const resumen = answerEstadoLlano(q, ent, s, d, { forzar: true, transmisibles: true });
  if (!resumen) return null;
  const intro = /\balerta\b/.test(q) ? 'No emito alertas sanitarias (las oficiales las publica la Secretaría de Salud), pero esto es lo que muestran los casos notificados:' : 'No doy recomendaciones de viaje, pero esto es lo que muestran los casos notificados:';
  return `${intro}\n\n${resumen}`;
}

// ── Nombres coloquiales que abarcan dos padecimientos publicados: se pregunta cuál, con botones ───────────────────────
const AMBIGUOS_COLOQUIALES = [
  [/\bprostata\b/, /\b(hiperplasia|cancer|tumor|crecimiento)\b/, '«Próstata» puede referirse a la **hiperplasia de la próstata** (crecimiento benigno) o al **cáncer de próstata**.', ['hiperplasia de la prostata', 'cancer de prostata']],
  [/\b(cancer|tumor)\b.*\b(utero|matriz)\b|\butero\b(?!.*\bmatriz de)/, /\b(cuello|cervicouterino|cervical|endometrio|cuerpo)\b/, '«Útero» o «matriz» puede referirse al **cáncer del cuello del útero** o al **cáncer del cuerpo del útero (endometrio)**.', ['cancer cervicouterino', 'cancer de endometrio']],
];
export function answerAmbiguoColoquial(q, ent) {
  if ((ent.padecimientos || []).length > 1) return null;
  for (const [re, excluye, texto, opciones] of AMBIGUOS_COLOQUIALES) {
    if (!re.test(q) || excluye.test(q)) continue;
    const lugar = ent.estado ? ` en ${ent.estado}` : '';
    const etiqueta = (o) => o.replace(/\bprostata\b/, 'próstata').replace(/^cancer/, 'Cáncer').replace(/^hiperplasia/, 'Hiperplasia');
    return `${texto} ¿Cuál te interesa?\n<!--SIN_GRAFICA-->` + sigue(opciones.map((o) => ({ t: `${etiqueta(o)}${lugar}`, q: `${o}${lugar}` })));
  }
  return null;
}

// ── Un familiar con un padecimiento («Mi mamá tuvo un derrame cerebral»): empatía breve, oferta de datos y contexto ──────
const FAMILIAR = /\b(mi|a mi) (hij[oa]|nin[oa]|bebe|abuel[ao]|abuelita|abuelito|mama|papa|espos[oa]|herman[oa]|niet[oa]|tio|tia|prim[oa]|suegr[oa]|pareja|amig[oa])\b/;
const PADECE = /\b(tiene|tuvo|le dio|le diagnosticaron|padece|sufre|tiene la|tiene el|enfermo de|enferma de)\b/;
export function answerFamiliar(q, ent) {
  if (!ent.padecimiento || !FAMILIAR.test(q) || !PADECE.test(q)) return null;
  if (/\b(cuant\w*|casos|hay|como va|estadistica\w*|brote|que tan comun|comun)\b/.test(q)) return null;
  const ACENTO = { mama: 'mamá', papa: 'papá', bebe: 'bebé', tio: 'tío', tia: 'tía', nino: 'niño', nina: 'niña', suegro: 'suegro', suegra: 'suegra' };
  const crudo = q.match(FAMILIAR)[2];
  const familiar = ACENTO[crudo] || crudo;
  const lugar = ent.estado ? ` en ${ent.estado}` : ' en tu estado';
  return `Lamento que tu ${familiar} esté pasando por esto. No puedo dar orientación médica, pero sí puedo contarte cómo van los casos${lugar}: ` +
    `dime el estado si quieres que lo revise${ent.estado ? '' : ' (por ejemplo, «en Jalisco»)'}.\n<!--SIN_GRAFICA-->`;
}
