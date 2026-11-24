/**
 * conversacion.js — charla, ayuda, síntomas y ranking entre padecimientos (rediseño conversacional, 24-nov-2026).
 *
 * La mesa redonda encontró que el EpiBot no respondía «gracias», «¿qué puedes hacer?» ni «tengo fiebre, ¿qué hago?», y
 * que el saludo hablaba de motores y de cuatro padecimientos cuando el sitio publica 152. Estos handlers van al inicio de
 * la cadena de kb.js. Ninguno da consejo médico ni cifras inventadas: el ranking sale de resumen_padecimientos.json, que
 * genera scripts/build_resumen_padecimientos.mjs desde las vistas publicadas.
 */
import { RELEASES } from './release_config.js?v=54';

const LEGACY = 4;
export const TOTAL_PUBLICADOS = () => RELEASES.length + LEGACY;
const ent0 = (n) => Math.round(n).toLocaleString('es-MX');
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
const AYUDA = /\b(que puedes hacer|que sabes hacer|que haces|en que me ayudas|en que me puedes ayudar|como te uso|como funciona esto|ayuda|help|que te puedo preguntar|que puedo preguntar|para que sirves|instrucciones)\b/;

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
  if (!conDatos && GRACIAS.test(q) && n <= 6) {
    return 'Con gusto. ¿Quieres revisar otro padecimiento o estado?\n<!--SIN_GRAFICA-->' + sigue(EJEMPLOS.slice(0, 3));
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
const SINTOMA = /\b(tos|fiebre|calentura|diarrea|vomito|vomitos|nauseas|ronchas|sarpullido|comezon|dolor de cabeza|dolor de garganta|dolor de estomago|dolor de huesos|escalofrios|gripa|gripe|moqueo|mareo|mareos|sangrado|granos|manchas en la piel|ojos rojos|cansancio)\b/;
const PERSONAL = /\b(tengo|me duele|me salio|me salieron|me siento|ando con|estoy con|amaneci con|mi (hijo|hija|mama|papa|bebe|esposa|esposo|abuelo|abuela|nino|nina) (tiene|trae|anda con)|me pico|me mordio)\b/;
const PIDE_DX = /\b(que hago|que debo hacer|que me tomo|que tomo|que le doy|es dengue|sera dengue|tengo dengue|sera que tengo|me estoy enfermando|a donde voy|a donde acudo)\b/;

export function answerSintomas(q, ent) {
  if (!SINTOMA.test(q) || !(PERSONAL.test(q) || PIDE_DX.test(q))) return null;
  const pad = ent.padecimiento;
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
const RANKING = /\b(que|cuales)\b.*\b(enfermedades|padecimientos|infecciones|males)\b.*\b(alza|aumentar|aumentando|aumentan|suben|subiendo|subir|crecen|creciendo|repuntan|preocupar|preocupantes|mas casos|bajan|bajando|disminuyen)\b|\b(que esta subiendo|que va al alza|que sube|que esta aumentando|que esta bajando|lo que sube|lo que mas sube)\b/;

export function answerRankingPadecimientos(q, ent, s, d) {
  if (ent.padecimiento || (ent.padecimientos || []).length) return null;
  if (!RANKING.test(q)) return null;
  const res = d?.resumen_padecimientos;
  if (!res || !Array.isArray(res.padecimientos)) {
    return 'Todavía no tengo el resumen de todos los padecimientos. Pregúntame por uno en particular; por ejemplo, «¿cómo va la varicela?».\n<!--SIN_GRAFICA-->';
  }
  const relevantes = res.padecimientos.filter((x) => Math.max(x.O4, x.F4) >= 50);
  const orden = (xs) => [...xs].sort((a, b) => (a.confiabilidad === 'baja') - (b.confiabilidad === 'baja') || Math.abs(b.delta) - Math.abs(a.delta));
  const suben = orden(relevantes.filter((x) => x.tendencia === 'sube')).slice(0, 6);
  const bajan = orden(relevantes.filter((x) => x.tendencia === 'baja')).slice(0, 4);
  const masCasos = /\bmas casos\b/.test(q);
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
    lineas.push(...suben.map(fila));
    if (bajan.length) lineas.push('', '**Lo que más se espera que baje:**', '', ...bajan.map(fila));
  }
  lineas.push('', `Comparo ${res.padecimientos.length} padecimientos con datos hasta la semana del ${res.corte}; dejo fuera los de menos de 50 casos, donde un cambio porcentual engaña, ` +
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
const LEGACY_ESPECIFICO = /\b(historic\w*|brote|brotes|nino|enso|oni|2018|2019|2020|2021|2022|acumulad\w*|motor\w*|metric\w*|smape|mase|zoom|mapa|ranking|compar\w*|vs|contra|sintoma\w*|que es|que son|prevencion|prevenir|causa\w*|tratamiento|clima|lluvia\w*|modelo\w*|escenario|proyeccion|anos|rondas?|semaforo|timelapse|treemap|radar|pdf|reporte|validacion|seguimiento|calibracion|grafic\w*|tabla|por sexo|hombres y mujeres|region\w*|macrorregion\w*|mas casos|que estado|cual estado|estados|lugar|mosquito|aedes|serotipo\w*|grave|hemorragic\w*|muertes|defunciones|letalidad|edad|edades|te puede|a ti|puedes|enfermarte|modela\w*|gana|ganara|ganador|que sabes|sabes)\b/;
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
const CONFIANZA_GENERAL = /\b(que tan|son|es|que tanto|se puede|puedo)\b.*\b(confiables?|fiables?|precisos?|exactos?|confiar|creer|atinan|aciertan)\b|\b(confiabilidad|precision) de (sus|tus|los|las)\b/;
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
  ['Nuevo León', ['monterrey', 'san pedro garza garcia', 'apodaca', 'san nicolas de los garza', 'escobedo']],
  ['Jalisco', ['guadalajara', 'zapopan', 'tlaquepaque', 'tonala', 'puerto vallarta']],
  ['Baja California', ['tijuana', 'mexicali', 'ensenada', 'rosarito', 'tecate']],
  ['Baja California Sur', ['los cabos', 'cabo san lucas', 'san jose del cabo']],
  ['Yucatán', ['merida', 'valladolid', 'progreso']],
  ['Quintana Roo', ['cancun', 'playa del carmen', 'chetumal', 'cozumel', 'tulum']],
  ['Guanajuato', ['irapuato', 'celaya', 'salamanca', 'san miguel de allende']],
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
const CIUDAD_RE = CIUDADES.flatMap(([estado, cs]) => cs.map((c) => [estado, c, new RegExp(`\\b${c}\\b`)]))
  .sort((a, b) => b[1].length - a[1].length);
const CIUDAD_ACENTOS = { cancun: 'Cancún', merida: 'Mérida', culiacan: 'Culiacán', mazatlan: 'Mazatlán', torreon: 'Torreón',
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
