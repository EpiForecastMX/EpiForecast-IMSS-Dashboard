/**
 * cifras_contrato.mjs — El contrato de vocabulario, ejecutable.
 *
 * Fuente normativa: EpiForecast-MX/docs/CONTRATO_VOCABULARIO_CIFRAS.md (24-ago-2026).
 *
 * Existe porque el 24-ago-2026 el sitio publicado respondía **435** donde las
 * diapositivas decían **333** y el manifiesto canónico decía **432**, y ningún control
 * lo veía: `rag_verify` comprobaba que cada chunk tuviera un vector válido, nunca lo que
 * el chunk DECÍA. El índice estaba perfectamente sincronizado y perfectamente equivocado.
 *
 * Las agujas van con CONTEXTO a propósito. Un número pelado no identifica una celda: en
 * este mismo corpus «102» aparece de forma legítima como SMAPE del backtest de NB-GLM
 * («SMAPE 52 vs Prophet 102»), y prohibirlo a secas convertiría un control en un estorbo.
 * Por eso se persigue la FORMA en que la cifra mala aparece —«102 modelos», «435 series»—
 * y no la cifra suelta.
 */

/** Las cuatro cifras buenas, y qué cuenta cada una. */
export const VOCABULARIO = {
  neuro: 333, // series neuro productivas: 3 padecimientos x 37 geografías x 3 sexos
  dengue: 99, // series de dengue productivas: 33 geografías x 3 sexos
  total: 432, // series productivas totales (333 + 99)
  // Gráficos publicados en la galería. Ronda W37: 333 neuro + 99 dengue; las 4 regiones de
  // dengue (12 gráficos) salen porque no forman parte de la asignación (hasta W33 eran 444).
  // Se CUENTA en la lista `DATA` de Reports/index.html (problemasDeGaleria), no se supone.
  galeria: 432,
};

/** Motores elegibles por cohorte. «Motor» es familia algorítmica, nunca una serie. */
export const MOTORES = {
  neuro: ['Prophet', 'DeepAR', 'Ensemble', 'Stacking'],
  // Ronda W37: NBGLM suspendido por inestabilidad recursiva (ENMIENDA_DENGUE_NBGLM_W37,
  // 13-oct-2026). Restituirlo exige corregir la recursión, reentrenar y recalificar.
  dengue: ['Prophet', 'DeepAR'],
};

/** Motores entrenados que NO pueden publicarse en esta ronda, con su causa. */
export const SUSPENDIDOS = {
  dengue: { NBGLM: 'suspendido en W37 por inestabilidad de su predicción recursiva' },
};

const UNIDAD = '(?:modelos?|series|gr[áa]ficos?)';

/**
 * Cifras retiradas, con la forma exacta en que aparecen cuando están mal.
 * (patrón, motivo). El patrón se aplica sobre el texto del chunk.
 */
export const CIFRAS_RETIRADAS = [
  [new RegExp(`\\b435\\s+${UNIDAD}\\b`, 'i'), '435 = 432 + los 3 nacionales de dengue contados dos veces'],
  [new RegExp(`\\b145\\s+${UNIDAD}\\b`, 'i'), '145 por sexo es consecuencia del 435; el valor correcto es 144'],
  [new RegExp(`\\b102\\s+${UNIDAD}\\b`, 'i'), '102 de dengue arrastra 3 duplicados y 13 selecciones no elegibles; son 99'],
  [/\b15\s+(?:modelos|series)\s+nacionales\b/i, 'los nacionales son 12 (9 neuro + 3 dengue), no 15'],
  [/111\s*[x×*]\s*3\s*=\s*435/i, 'ecuación falsa: 111 x 3 = 333'],
  [/\b444\s+gr[áa]ficos?\b/i, 'ronda W37: la galería publica 432 gráficos (sin las 4 regiones de dengue)'],
];

/**
 * Revisa el texto de los chunks del corpus contra el contrato.
 * @param {{id:string,text:string}[]} chunks
 * @returns {string[]} problemas, vacío si todo está bien
 */
export function problemasDeCifras(chunks) {
  const problemas = [];
  for (const c of chunks || []) {
    const texto = String(c?.text ?? '');
    if (!texto) continue;
    for (const [patron, motivo] of CIFRAS_RETIRADAS) {
      const m = texto.match(patron);
      if (m) problemas.push(`${c.id}: «${m[0].trim()}» — ${motivo}`);
    }
  }
  return problemas;
}

/**
 * Revisa el knowledge.json publicado. Corre sin API key, así que puede ser gate de
 * despliegue. Comprueba el inventario y la elegibilidad de motores de dengue, que es
 * donde vivían las selecciones stale de Ensemble/Stacking.
 * @param {object} kb  contenido de knowledge.json
 * @returns {string[]} problemas
 */
export function problemasDeKnowledge(kb) {
  const problemas = [];
  const r = kb?.rosters ?? {};
  if (r.total_series !== VOCABULARIO.total) {
    problemas.push(`rosters.total_series = ${r.total_series}; debe ser ${VOCABULARIO.total}`);
  }
  if (r.gallery_items !== VOCABULARIO.galeria) {
    problemas.push(`rosters.gallery_items = ${r.gallery_items}; debe ser ${VOCABULARIO.galeria}`);
  }
  const pc = r.por_cohorte ?? {};
  if (pc.neuro !== VOCABULARIO.neuro || pc.dengue !== VOCABULARIO.dengue) {
    problemas.push(
      `rosters.por_cohorte = ${JSON.stringify(pc)}; debe ser {neuro:${VOCABULARIO.neuro}, dengue:${VOCABULARIO.dengue}}`
    );
  }

  // `stats` describe la cohorte NEURO y sólo la neuro. Si vuelve a traer Dengue, es que
  // alguien volvió a contar desde tabla_333 sin filtrar (el no-op de filter_neuro).
  const s = kb?.stats ?? {};
  if (s.total_modelos !== VOCABULARIO.neuro) {
    problemas.push(`stats.total_modelos = ${s.total_modelos}; stats es la cohorte neuro y debe ser ${VOCABULARIO.neuro}`);
  }
  if (s.por_pad && Object.prototype.hasOwnProperty.call(s.por_pad, 'Dengue')) {
    problemas.push('stats.por_pad trae Dengue; stats es neuro y Dengue viaja en su propia sección');
  }
  const dm = s.dist_motor ?? {};
  const sumaNeuro = Object.values(dm).reduce((a, b) => a + b, 0);
  if (sumaNeuro !== VOCABULARIO.neuro) {
    problemas.push(`stats.dist_motor suma ${sumaNeuro}; debe sumar ${VOCABULARIO.neuro}`);
  }
  for (const m of Object.keys(dm)) {
    if (!MOTORES.neuro.includes(m)) problemas.push(`stats.dist_motor trae «${m}», que no es motor neuro`);
  }

  // --- Inventario servido, no sólo declarado -------------------------------------------
  // `rosters` puede estar bien mientras `prod_models` sigue trayendo las 435 filas: son dos
  // caminos distintos dentro del mismo generador, y el que el EpiBot recorre para responder
  // por serie es éste. Comprobar sólo los totales dejaba pasar exactamente ese caso.
  const pm = Array.isArray(kb?.prod_models) ? kb.prod_models : null;
  if (!pm) {
    problemas.push('no hay prod_models en knowledge.json');
  } else {
    if (pm.length !== VOCABULARIO.neuro) {
      problemas.push(`prod_models trae ${pm.length} filas; stats es la cohorte neuro y deben ser ${VOCABULARIO.neuro}`);
    }
    const conDengue = pm.filter((m) => String(m?.padecimiento ?? '').toLowerCase() === 'dengue').length;
    if (conDengue) {
      problemas.push(`prod_models trae ${conDengue} filas de Dengue; Dengue viaja en su propia sección`);
    }
    const vistas = new Set();
    let repetidas = 0;
    for (const m of pm) {
      const clave = `${m?.padecimiento}|${m?.entidad}|${m?.sexo}`;
      if (vistas.has(clave)) repetidas++;
      vistas.add(clave);
    }
    if (repetidas) {
      problemas.push(`prod_models tiene ${repetidas} claves (padecimiento, entidad, sexo) repetidas: es la firma del doble conteo por motor`);
    }
  }

  // Por sexo: 333 / 3. Un 145 aquí significa que alguien volvió a contar sobre las 435.
  const porSexo = s.por_sexo ?? {};
  for (const sx of ['hombres', 'mujeres', 'general']) {
    const n = porSexo?.[sx]?.n;
    if (n !== VOCABULARIO.neuro / 3) {
      problemas.push(`stats.por_sexo.${sx}.n = ${n}; debe ser ${VOCABULARIO.neuro / 3}`);
    }
  }

  // Nacional neuro: 3 padecimientos x 3 sexos. El 15 del catálogo inflado son estos 9 más
  // las 3 series `Dengue · Nacional` contadas una segunda vez, por el otro motor.
  const nac = s.por_estado?.Nacional?.n;
  if (nac !== 9) {
    problemas.push(`stats.por_estado.Nacional.n = ${nac}; la cohorte neuro tiene 9 nacionales (3 padecimientos x 3 sexos)`);
  }

  // Dengue: 99 series, sólo motores elegibles, ninguno suspendido, y los productivos
  // derivados de la asignación (no de una lista escrita a mano).
  const d = kb?.dengue ?? {};
  const ddm = d.dist_motor ?? {};
  const sumaDengue = Object.values(ddm).reduce((a, b) => a + b, 0);
  if (sumaDengue !== VOCABULARIO.dengue) {
    problemas.push(`dengue.dist_motor suma ${sumaDengue}; debe sumar ${VOCABULARIO.dengue}`);
  }
  for (const m of Object.keys(ddm)) {
    if (!MOTORES.dengue.includes(m) && !(m in SUSPENDIDOS.dengue)) {
      problemas.push(`dengue.dist_motor trae «${m}», no elegible para dengue (los árboles no extrapolan)`);
    }
  }
  for (const [m, causa] of Object.entries(SUSPENDIDOS.dengue)) {
    if (Object.prototype.hasOwnProperty.call(ddm, m)) {
      problemas.push(`dengue.dist_motor trae «${m}»: ${causa}`);
    }
  }
  const prodDeclarados = [...(d.motores_productivos ?? [])].sort();
  const prodAsignados = Object.keys(ddm).filter((m) => ddm[m] > 0).sort();
  if (JSON.stringify(prodDeclarados) !== JSON.stringify(prodAsignados)) {
    problemas.push(
      `dengue.motores_productivos = ${JSON.stringify(d.motores_productivos)}; debe derivarse de dist_motor (${JSON.stringify(prodAsignados)})`
    );
  }
  if (Object.prototype.hasOwnProperty.call(d, 'proyeccion_anios')) {
    problemas.push('dengue.proyeccion_anios presente: la proyección NB-GLM multi-año está retirada del producto');
  }
  return problemas;
}

// ---------------------------------------------------------------------------------------
// Superficies publicas
// ---------------------------------------------------------------------------------------
//
// Anadido el 25-ago-2026, tras una auditoria externa. Hasta entonces este gate abria
// UNICAMENTE `knowledge.json`: pasaba en verde mientras `index.html`, `bento.json` y
// `EpiDashboard.html` --lo que la gente realmente lee-- quedaban fuera de su alcance. El
// contrato se cumplia en las tres, pero no estaba defendido, que no es lo mismo. Un gate
// cuyo alcance es mas estrecho que su nombre es un falso verde con retardo.
//
// `netlify.toml` publica con `publish = "."`, asi que la superficie es todo .html/.json
// de la raiz, no una lista escogida a mano: enumerarla a mano volveria a dejar huecos.

/** Regiones que el publico NO lee y que por tanto quedan fuera del contrato. */
const EXENCIONES = [
  [/<!--[\s\S]*?-->/g, 'comentario HTML'],
  [/\/\*[\s\S]*?\*\//g, 'comentario de bloque'],
  [/(^|[^:'"`\w])\/\/[^\n]*/g, 'comentario de linea'],
];

/**
 * Borra lo que el publico no lee, CONSERVANDO las posiciones para que el numero de linea
 * siga siendo cierto: cada region se sustituye por espacios, no se elimina.
 * @returns {{texto:string, exentos:number}}
 */
export function sinRegionesNoLeidas(texto) {
  let exentos = 0;
  let out = texto;
  for (const [re] of EXENCIONES) {
    out = out.replace(re, (m) => {
      exentos++;
      return m.replace(/[^\n]/g, ' ');
    });
  }
  return { texto: out, exentos };
}

/**
 * Aplana un JSON a texto revisable, saltando las claves que empiezan por `_`: son notas
 * de mantenimiento (por que se retiro un bloque, de que fecha es un snapshot) y nadie las
 * pinta. `bento.json._nota_motor` es justo eso, y explica por que 435 era falso.
 * @returns {{texto:string, exentos:number}}
 */
export function jsonRevisable(raw) {
  let dato;
  try {
    dato = JSON.parse(raw);
  } catch {
    return { texto: raw, exentos: 0 }; // no parsea: se revisa crudo, mejor pasarse que faltar
  }
  const partes = [];
  let exentos = 0;
  // Solo estas claves declaran INVENTARIO. Sin este filtro, cualquier dato de una serie
  // temporal --145 casos de dengue en una semana-- disparaba la aguja «145 series»: 813
  // falsos positivos en la primera prueba. El contrato persigue la FORMA en que la cifra
  // mala aparece, no la cifra suelta, y esto lo mantiene.
  const CLAVE_INVENTARIO = /^(total|totales|count|cuenta|n_|num|series|modelos|motores|graficos|gr[aá]ficos|inventario|gallery|prod_)/i;
  const anda = (nodo, clave = '', enLista = false) => {
    // `enLista` se PROPAGA hacia dentro. Sin propagarlo, `[{"total":145}]` volvia a tratarse
    // como inventario en cuanto se entraba al objeto, y un dato tabulado disparaba la aguja.
    if (Array.isArray(nodo)) return nodo.forEach((v) => anda(v, clave, true));
    if (nodo && typeof nodo === 'object') {
      for (const [k, v] of Object.entries(nodo)) {
        if (k.startsWith('_')) {
          exentos++;
          continue;
        }
        anda(v, k, enLista);
      }
      return;
    }
    // Dentro de una lista, un numero es un DATO (una serie temporal), nunca un inventario.
    if (typeof nodo === 'number' && !enLista && CLAVE_INVENTARIO.test(clave)) {
      // `total: 435` se convierte en «total 435 series» para que las agujas del contrato,
      // que persiguen «<cifra> <unidad>», puedan verlo. La unidad se toma del nombre del
      // campo cuando lo sugiere; si no, se prueban las tres.
      const u = /gr[aá]fic/i.test(clave) ? 'gráficos'
        : /serie/i.test(clave) ? 'series'
        : /model|motor/i.test(clave) ? 'modelos'
        : null;
      partes.push(u ? `${clave} ${nodo} ${u}` : `${clave} ${nodo} series`);
      if (!u) partes.push(`${clave} ${nodo} modelos`, `${clave} ${nodo} gráficos`);
      return;
    }
    if (typeof nodo === 'number') return;
    // Los numeros TAMBIEN se revisan. El bento.json que motivo el contrato guardaba la
    // cifra mala como {"motor":{"total":435}}, no como texto: quedarse solo con las cadenas
    // dejaba pasar justo la forma que hay que cazar. Se emite «clave valor» para que las
    // agujas contextuales («435 series») puedan reconocerla por el nombre del campo.
    if (typeof nodo === 'string') partes.push(nodo);
  };
  anda(dato);
  return { texto: partes.join('\n'), exentos };
}

/**
 * Revisa TODA la superficie publicada contra el contrato.
 * @param {string} raiz  directorio que netlify publica
 * @param {(dir:string)=>string[]} listar  inyectable para la prueba
 * @param {(f:string)=>string} leer        inyectable para la prueba
 * @returns {{problemas:string[], revisados:number, exentos:number}}
 */
export const IGNORAR_DIR = new Set(['node_modules', '.git', '.netlify', 'dist']);

export function problemasDeSuperficies(raiz, listar, leer) {
  const problemas = [];
  let revisados = 0;
  let exentos = 0;
  // Recorrido RECURSIVO. La primera version leia solo la raiz: vigilaba 26 archivos y dejaba
  // fuera los servidos bajo `Reports/` y `epibot/`. Netlify publica con `publish = "."`, asi
  // que TODO lo que cuelga de ahi es superficie.
  const recorre = (dir, prefijo = '') => {
    let entradas;
    try {
      entradas = listar(dir);
    } catch (e) {
      problemas.push(`no se pudo listar ${prefijo || '.'}: ${e.message}`);
      return [];
    }
    const salida = [];
    for (const e of entradas.sort()) {
      const nombre = typeof e === 'string' ? e : e.name;
      const esDir = typeof e === 'string' ? false : !!e.isDirectory?.();
      if (esDir) {
        if (IGNORAR_DIR.has(nombre) || nombre.startsWith('.')) continue;
        salida.push(...recorre(`${dir}/${nombre}`, `${prefijo}${nombre}/`));
      } else {
        salida.push(`${prefijo}${nombre}`);
      }
    }
    return salida;
  };
  for (const nombre of recorre(raiz)) {
    if (!/\.(html|json)$/i.test(nombre)) continue;
    let crudo;
    try {
      crudo = leer(`${raiz}/${nombre}`);
    } catch (e) {
      problemas.push(`no se pudo leer ${nombre}: ${e.message}`);
      continue;
    }
    const { texto, exentos: n } = nombre.toLowerCase().endsWith('.json')
      ? jsonRevisable(crudo)
      : sinRegionesNoLeidas(crudo);
    revisados++;
    exentos += n;
    const lineas = texto.split('\n');
    for (let i = 0; i < lineas.length; i++) {
      for (const [patron, motivo] of CIFRAS_RETIRADAS) {
        const m = lineas[i].match(patron);
        if (m) problemas.push(`${nombre}:${i + 1}: «${m[0].trim()}» — ${motivo}`);
      }
    }
  }
  return { problemas, revisados, exentos };
}

// ── Fallback estático del banner de novedades ─────────────────────────────────────────
// `index.html` lleva un banner estático (`#newsBannerRow`) que se ve cuando falla el fetch
// de `news.json`; el JS lo sobreescribe con items[0] como lead e items[1..2] como minis.
// Si el generador deja el estático desalineado (W33 salió con titular del CALASS, fecha y
// subtítulo de W33, 2-sep-2026), el sitio miente justo cuando más importa. El gate exige
// que estático y `news.json` digan lo mismo.
const desent = (s) =>
  String(s == null ? '' : s)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

export function bannerEstatico(indexHtml) {
  const m = indexHtml.match(
    /<div class="news-banner-row" id="newsBannerRow">([\s\S]*?)\n {8}<\/div>/
  );
  if (!m) return null;
  const bloque = m[1];
  const iMinis = bloque.indexOf('news-mini-list');
  const lead = iMinis >= 0 ? bloque.slice(0, iMinis) : bloque;
  const minis = iMinis >= 0 ? bloque.slice(iMinis) : '';
  const uno = (re, txt) => {
    const r = txt.match(re);
    return r ? desent(r[1]) : null;
  };
  return {
    lead: {
      title: uno(/<div class="news-lead-title">([\s\S]*?)<\/div>/, lead),
      date: uno(/<span class="news-date">([\s\S]*?)<\/span>/, lead),
      tag: uno(/<span class="news-tag news-tag--[^"]*">([\s\S]*?)<\/span>/, lead),
      type: uno(/<span class="news-tag news-tag--([^"]*)">/, lead),
    },
    minis: [...minis.matchAll(/<span class="news-mini-title">([\s\S]*?)<\/span>/g)].map((r) =>
      desent(r[1])
    ),
  };
}

export function problemasDelBannerEstatico(indexHtml, news) {
  const problemas = [];
  const items = (news && Array.isArray(news.items) ? news.items : []).slice(0, 3);
  if (!items.length) return ['news.json sin items: no hay con qué contrastar el banner estático'];
  const est = bannerEstatico(indexHtml);
  if (!est) return ['index.html sin el bloque estático #newsBannerRow'];
  const lead = items[0];
  for (const [campo, esperado] of [
    ['title', lead.title],
    ['date', lead.date],
    ['tag', lead.tag],
    ['type', lead.type || 'datos'],
  ]) {
    if (est.lead[campo] !== desent(esperado)) {
      problemas.push(
        `banner estático de index.html: lead.${campo} dice «${est.lead[campo]}» y news.json[0] ` +
          `dice «${desent(esperado)}»`
      );
    }
  }
  const esperados = items.slice(1).map((it) => desent(it.title));
  if (JSON.stringify(est.minis) !== JSON.stringify(esperados)) {
    problemas.push(
      `banner estático de index.html: minis ${JSON.stringify(est.minis)} ≠ news.json[1..2] ` +
        `${JSON.stringify(esperados)}`
    );
  }
  return problemas;
}

// --- Distribuciones escritas a mano en las páginas ------------------------------------------
// conclusiones.html y otras páginas traen «Distribución neuro: Ensemble 109, …» como texto fijo.
// Ninguna se regenera sola, así que se quedan con la asignación de la ronda anterior (W37 llegó
// con «DeepAR 98 | Prophet 94 | …» en conclusiones). Cada una debe decir lo mismo que
// knowledge.json, que el generador deriva de la asignación congelada.
const RE_DISTRIBUCION =
  /Distribuci(?:ó|&oacute;)n (neuro|Dengue|productiva actual)([\s\S]{0,400}?)(?:<\/p>|<\/tr>|<\/li>)/g;
const RE_MOTOR_N = /\b(Prophet|DeepAR|Ensemble|Stacking|NB-?GLM)\b(?:<\/span>)?\s*[:|]?\s*(\d+)\b/g;

const _normMotor = (m) => (m.replace('-', '') === 'NBGLM' ? 'NBGLM' : m);
const _ordena = (o) =>
  JSON.stringify(Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b))));

export function problemasDeDistribuciones(archivo, html, kb) {
  const problemas = [];
  const esperado = {
    neuro: kb?.stats?.dist_motor ?? null,
    dengue: Object.fromEntries(
      Object.entries(kb?.dengue?.dist_motor ?? {}).filter(([, n]) => Number(n) > 0)
    ),
  };
  for (const m of sinRegionesNoLeidas(html).texto.matchAll(RE_DISTRIBUCION)) {
    const cohorte = m[1] === 'Dengue' ? 'dengue' : 'neuro';
    const dicho = {};
    for (const [, motor, n] of m[2].matchAll(RE_MOTOR_N)) dicho[_normMotor(motor)] = Number(n);
    if (!Object.keys(dicho).length) continue; // un título («Distribución de …») sin cifras
    const ref = esperado[cohorte];
    if (!ref || !Object.keys(ref).length) {
      problemas.push(`${archivo}: «Distribución ${m[1]}» sin referencia en knowledge.json`);
    } else if (_ordena(dicho) !== _ordena(ref)) {
      problemas.push(
        `${archivo}: «Distribución ${m[1]}» dice ${_ordena(dicho)} y knowledge.json ${_ordena(ref)}`
      );
    }
  }
  return problemas;
}

// --- Métricas de selección retiradas (decisión del autor, 13-oct-2026) ---------------------
// En la ronda con corte W37 toda métrica de error por serie o por motor (SMAPE, MASE, RMSE, MAE,
// sus medias/medianas, rankings y top/bottom por ellas, «precisión histórica») es el error de la
// ventana W28–W37 con la que se eligió el motor productivo: diagnóstico de selección, no
// evaluación independiente. El generador las quita de knowledge.json y declara
// `metricas_seleccion.publicadas === false`; las vistas operativas no las pintan.
//
// Dos controles, uno por cada puerta por donde volverían:
//   · knowledge.json: la declaración presente y NINGUNA clave de métrica fuera de `definiciones`
//     (el glosario sí se queda), y sin la sección `rendimiento_2026`.
//   · las páginas operativas: ningún «SMAPE 16.1%», «MASE de 0.57», «< 1.0 MASE», columna de
//     métrica en una tabla ni plantilla JS que interpole un valor de métrica.

/** La misma regla de retiro que aplica el generador (build_web_knowledge.py). */
export const RE_CLAVE_METRICA = /(^|_)(smape|mase|rmse|mae)(_|$)/i;
export const esClaveDeMetrica = (k) => RE_CLAVE_METRICA.test(k) || String(k).startsWith('precision_historica');

/**
 * knowledge.json con las métricas de selección retiradas: declaración + cero claves de métrica.
 * Cada clave que sobrevive es un problema (con su ruta), para que se arregle en el generador.
 * @param {object} kb  contenido de knowledge.json
 * @returns {string[]} problemas
 */
export function problemasDeMetricasSeleccion(kb) {
  const problemas = [];
  const ms = kb?.metricas_seleccion;
  if (!ms || ms.publicadas !== false) {
    problemas.push(
      `metricas_seleccion.publicadas = ${JSON.stringify(ms?.publicadas)}; knowledge.json debe declarar ` +
        '`metricas_seleccion.publicadas === false` (las métricas W28–W37 son diagnóstico de selección)'
    );
  }
  if (kb && Object.prototype.hasOwnProperty.call(kb, 'rendimiento_2026')) {
    problemas.push('rendimiento_2026 presente: los cuadros SMAPE/MASE por motor son diagnóstico de selección y se retiran');
  }
  const anda = (nodo, ruta) => {
    if (Array.isArray(nodo)) return nodo.forEach((v, i) => anda(v, `${ruta}[${i}]`));
    if (!nodo || typeof nodo !== 'object') return;
    for (const [k, v] of Object.entries(nodo)) {
      if (ruta === '' && (k === 'definiciones' || k === 'rendimiento_2026')) continue; // glosario / ya marcado
      const aqui = ruta ? `${ruta}.${k}` : k;
      if (esClaveDeMetrica(k)) problemas.push(`${aqui}: métrica de selección W28–W37 publicada en knowledge.json`);
      anda(v, aqui);
    }
  };
  anda(kb, '');
  return problemas;
}

/** Vistas operativas que no pueden pintar valores de métricas de selección. */
export const PAGINAS_OPERATIVAS = ['index.html', 'Reports/index.html', 'epibot/index.html'];

const _M = '(?:s?mape|mase|rmse|mae)';
/** (patrón, qué caza) sobre el texto VISIBLE de una línea: sin comentarios y sin etiquetas. */
const RE_VALOR_METRICA = [
  // «SMAPE 16.1%», «SMAPE mediano del 16.1%», «MASE de 0.57», «SMAPE nac. 20.4%», «SMAPE: 0.5»
  [new RegExp(`\\b${_M}\\b\\s*(?:[:=(]\\s*)?(?:(?:de|del|nac\\.?|nacional|mediano|mediana|medio|media|promedio|prom\\.?|med)\\s+)*(?:[<>≤≥]\\s*)?\\d[\\d.,]*%?`, 'i'),
    'valor de métrica'],
  // «< 1.0 MASE», «20.4 % de SMAPE»
  [new RegExp(`\\d(?:[.,]\\d+)?\\s*%?\\s*(?:de\\s+)?\\b${_M}\\b`, 'i'), 'valor antes de la métrica'],
  // plantilla JS: 'SMAPE <b>' + s.smape + '%' · `SMAPE ${s.smape}%` · `MASE ${s.mase}`
  [new RegExp(`\\b${_M}\\b[^\\n]{0,40}?(?:\\$\\{[^}]*\\b${_M}\\w*|\\+\\s*[\\w.]*\\b${_M}\\w*)`, 'i'),
    'plantilla que interpola una métrica'],
];
/** Columna de métrica en una tabla (los valores van en otras filas: se caza el encabezado). */
const RE_COLUMNA_METRICA = new RegExp(`<th\\b[^>]*>\\s*${_M}\\b[^<]*</th>`, 'gi');

/**
 * Una página operativa no pinta valores de métricas de selección.
 * @param {string} archivo  nombre para el mensaje
 * @param {string} html     contenido crudo
 * @returns {string[]} problemas con archivo:línea
 */
export function problemasDeMetricasEnPagina(archivo, html) {
  const problemas = [];
  const { texto } = sinRegionesNoLeidas(String(html ?? ''));
  const lineas = texto.split('\n');
  for (let i = 0; i < lineas.length; i++) {
    for (const m of lineas[i].matchAll(RE_COLUMNA_METRICA)) {
      problemas.push(`${archivo}:${i + 1}: columna «${desent(m[0].replace(/<[^>]*>/g, ''))}» — métrica de selección W28–W37`);
    }
    // Texto visible: sin etiquetas y con las entidades resueltas («&lt; 1.0 MASE»).
    const visible = desent(lineas[i].replace(/<[^>]*>/g, ' '));
    for (const [re, que] of RE_VALOR_METRICA) {
      const m = visible.match(re);
      if (m) problemas.push(`${archivo}:${i + 1}: «${m[0].trim()}» — ${que} (diagnóstico de selección W28–W37)`);
    }
  }
  return problemas;
}

// --- Galería publicada: la lista `DATA` de Reports/index.html ------------------------------------
// La tarjeta que ve el público sale de esa lista. En el candidato W37 seguía con 444 elementos
// (12 regiones de dengue cuyos PNG ya se habían retirado) mientras knowledge.json decía 444 por
// otro camino: dos cifras iguales y ambas falsas. El conteo se toma de la lista, cada elemento
// debe tener su PNG y la cifra debe coincidir con knowledge.json y con el vocabulario.

const RE_DATA_GALERIA = /^const DATA = (\[.*\]);$/m;

/**
 * @param {string} indexHtml  contenido de Reports/index.html
 * @param {object|null} kb    knowledge.json
 * @param {(rel:string)=>boolean} existe  ¿existe Reports/<rel>?
 * @returns {{problemas:string[], conteo:Record<string,number>, total:number}}
 */
export function problemasDeGaleria(indexHtml, kb, existe) {
  const problemas = [];
  const m = String(indexHtml ?? '').match(RE_DATA_GALERIA);
  if (!m) return { problemas: ['Reports/index.html sin la línea `const DATA = [...]` de la galería'], conteo: {}, total: 0 };
  let items;
  try {
    items = JSON.parse(m[1]);
  } catch (e) {
    return { problemas: [`Reports/index.html: DATA no es JSON (${e.message})`], conteo: {}, total: 0 };
  }
  const conteo = {};
  const vistos = new Set();
  for (const it of items) {
    conteo[it.p] = (conteo[it.p] || 0) + 1;
    if (vistos.has(it.f)) problemas.push(`galería: «${it.f}» repetido`);
    vistos.add(it.f);
    if (!existe(it.f)) problemas.push(`galería: «${it.f}» sin PNG (tarjeta rota)`);
    if (it.p === 'Dengue' && /(^|\/)Region_/.test(it.f)) {
      problemas.push(`galería: «${it.f}» es una región de dengue, fuera de la asignación en la ronda W37`);
    }
  }
  const total = items.length;
  const dengue = conteo.Dengue || 0;
  if (total !== VOCABULARIO.galeria) problemas.push(`galería: ${total} gráficos; el vocabulario dice ${VOCABULARIO.galeria}`);
  if (dengue !== VOCABULARIO.dengue) problemas.push(`galería: ${dengue} gráficos de dengue; deben ser ${VOCABULARIO.dengue}`);
  if (total - dengue !== VOCABULARIO.neuro) problemas.push(`galería: ${total - dengue} gráficos neuro; deben ser ${VOCABULARIO.neuro}`);
  const declarado = kb?.rosters?.gallery_items;
  if (kb && declarado !== total) problemas.push(`knowledge.rosters.gallery_items = ${declarado}; la galería publica ${total}`);
  return { problemas, conteo, total };
}

// --- Métricas y afirmaciones de desempeño ANTERIORES a la ronda W37 ---------------------------
// Decisión del autor (14-oct-2026). EpiDashboard.html (SMAPE mediano 51.1 %, «Motor ganador»),
// comparacion_modelos.html (tablas RMSE/MAE/SMAPE/MASE por motor de abril de 2026, «ganador») y
// las notas de news.json (desviación del acumulado, SMAPE/MASE nacional, «el mejor en
// validación») traen cifras que NO son el diagnóstico de selección W28–W37: tienen otro origen y
// no se verificaron contra la asignación vigente. Se retiran de la presentación pública con su
// propio rótulo; los originales se archivan íntegros fuera del sitio.

/** Páginas que no pueden volver a pintar métricas o rankings de rondas anteriores. */
export const PAGINAS_METRICAS_ANTIGUAS = ['EpiDashboard.html', 'comparacion_modelos.html'];

const MOTIVO_ANTIGUA = 'métrica o afirmación de desempeño anterior a la ronda W37 (otro origen; no verificada)';

/** Afirmaciones de desempeño sin cifra que también se retiran (ranking, «ganador», «el mejor»). */
const RE_AFIRMACION_DESEMPENO = [
  [/\bmotor ganador\b/i, 'ranking de motores'],
  [/\bcelda verde\s*=\s*ganador\b/i, 'ranking de motores'],
  [/\bmejor modelo\b/i, '«mejor modelo»'],
  [/\bel mejor en validaci[oó]n\b/i, '«el mejor en validación»'],
  [/\bsupera a la persistencia\b/i, 'comparación de desempeño contra la persistencia'],
  [/\bse desv[ií]a del (?:total )?realmente observado\b/i, 'desviación del acumulado'],
  [/\bmejor (?:s?mape|mase|rmse|mae)\b/i, 'ranking por métrica'],
  [new RegExp(`(?:kpi-label|label)">[^<]*\\b${_M}\\b`, 'i'), 'indicador con métrica'],
  // «El SMAPE agregado del motor productivo bajó de 92.8 a 82.2», «SMAPE / MASE: … 8.7 % / 0.59»:
  // un valor decimal en la misma frase que la métrica (los años, sin decimales, no cuentan).
  [new RegExp(`\\b${_M}\\b[^.\\d<]{0,60}?\\d+[.,]\\d`, 'i'), 'valor de métrica en la frase'],
];

/** «SMAPE 2026» nombra un año, no un valor: se neutraliza antes de buscar valores. */
const _sinAnios = (t) => t.replace(new RegExp(`\\b(${_M})(\\s+)(20\\d\\d)\\b(?![.,]\\d)`, 'gi'), '$1$2del año $3');

const _entidades = (s) =>
  desent(String(s ?? ''))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

/** Problemas de una línea de texto (crudo con etiquetas) contra los patrones de desempeño. */
function _desempenoEnLinea(crudo) {
  const hallados = [];
  for (const m of crudo.matchAll(RE_COLUMNA_METRICA)) hallados.push(`columna «${desent(m[0].replace(/<[^>]*>/g, ''))}»`);
  const visible = _sinAnios(_entidades(crudo.replace(/<[^>]*>/g, ' ')));
  for (const [re] of RE_VALOR_METRICA) {
    const m = visible.match(re);
    if (m) hallados.push(`«${m[0].trim()}»`);
  }
  for (const [re, que] of RE_AFIRMACION_DESEMPENO) {
    const m = (re.source.includes('label') ? crudo : visible).match(re);
    if (m) hallados.push(`«${desent(m[0].replace(/<[^>]*>/g, '')).trim()}» (${que})`);
  }
  return hallados;
}

/**
 * Una página con métricas antiguas retiradas no vuelve a pintarlas.
 * @returns {string[]} problemas con archivo:línea
 */
export function problemasDeMetricasAntiguas(archivo, html) {
  const problemas = [];
  const { texto } = sinRegionesNoLeidas(String(html ?? ''));
  texto.split('\n').forEach((linea, i) => {
    for (const h of _desempenoEnLinea(linea)) problemas.push(`${archivo}:${i + 1}: ${h} — ${MOTIVO_ANTIGUA}`);
  });
  return problemas;
}

/**
 * news.json: fechas y acontecimientos se conservan; cifras y afirmaciones de precisión no.
 * Toda nota marcada `historico` lleva su `nota_historica`. El póster WCP conserva sus resultados
 * sellados («error de 5.0 % en ocho semanas»): no caen en estas agujas, que persiguen métricas
 * nombradas, rankings y la desviación del acumulado de las notas semanales.
 * @param {object} news  contenido de news.json
 * @returns {string[]} problemas
 */
export function problemasDeNoticias(news) {
  const problemas = [];
  const items = Array.isArray(news?.items) ? news.items : [];
  items.forEach((it, i) => {
    const partes = [it.title, it.summary, ...(Array.isArray(it.body) ? it.body : [])];
    for (const parte of partes) {
      for (const h of _desempenoEnLinea(String(parte ?? ''))) {
        problemas.push(`news.json items[${i}] («${it.title}»): ${h} — ${MOTIVO_ANTIGUA}`);
      }
    }
    if (it.historico && !String(it.nota_historica ?? '').trim()) {
      problemas.push(`news.json items[${i}] («${it.title}»): marcada histórica sin nota_historica`);
    }
  });
  return problemas;
}

// --- Seguimiento del pronóstico con corte (ronda W37, decisiones del autor del 14-oct-2026) ---
// La tabla del EpiBot «Real vs Pronóstico 2026» alineaba lo observado con TODAS las filas del
// pronóstico del año (el ajuste dentro de muestra W2–W37 incluido), rotulaba el ds legado como
// «Inicio» de la semana y calificaba la precisión. Ahora: comparaciones sólo en los pares
// posteriores al corte, periodo oficial del boletín, ausentes sin convertir en cero y el nacional
// por sexo rotulado como incremento neto del acumulado, sujeto a revisiones.

export const TITULO_SEGUIMIENTO = /^Seguimiento del pronóstico con corte W\d{1,2}$/;
export const DEF_SEXO_AGREGADO = 'incremento neto del acumulado por sexo, sujeto a revisiones';
const FASES_SEGUIMIENTO = ['observado', 'seguimiento', 'pronostico'];
const CLAVES_MOTOR = ['prophet', 'deepar', 'ensemble', 'stacking', 'nbglm'];
const DIA = 864e5;
const sinTilde = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Inicio (domingo, ISO yyyy-mm-dd) de la semana epidemiológica `s` del año `y`, calculado aquí y
 * no tomado del generador: la semana 1 es la de domingo a sábado que contiene el 4 de enero.
 */
export function inicioSemanaEpi(y, s) {
  const ene4 = Date.UTC(y, 0, 4);
  const w1 = ene4 - new Date(ene4).getUTCDay() * DIA;
  return new Date(w1 + (s - 1) * 7 * DIA).toISOString().slice(0, 10);
}

/**
 * `knowledge.weekly_comparison`: sin ajuste dentro de muestra, con el periodo oficial, los pares
 * del seguimiento iguales a `seguimiento_post_corte` y los ausentes ausentes.
 * @returns {string[]} problemas
 */
export function problemasDeSeguimientoSemanal(kb) {
  const out = [];
  const wc = kb?.weekly_comparison;
  const seg = kb?.seguimiento_post_corte;
  if (!wc || typeof wc !== 'object' || !Object.keys(wc).length) {
    return ['weekly_comparison ausente: la tabla del EpiBot no tiene el seguimiento con corte'];
  }
  const pares = new Map();
  for (const s of seg?.semanas ?? []) {
    for (const c of Object.values(s.cohortes ?? {})) {
      for (const n of c.nacional ?? []) if (n.sexo === 'general') pares.set(`${sinTilde(n.padecimiento)}|${s.etiqueta}`, n);
    }
  }
  for (const [pad, info] of Object.entries(wc)) {
    const q = (m) => out.push(`weekly_comparison.${pad}: ${m}`);
    if (info?.version !== 2) {
      const viejas = (info?.semanas ?? []).filter((w) => 'fecha' in w || 'error_pct' in w).length;
      q(`version ${info?.version}: debe ser la 2 (seguimiento con corte)${viejas ? `; ${viejas} semanas con fecha/error_pct de la tabla anterior (ajuste y seguimiento mezclados)` : ''}`);
      continue;
    }
    if (!TITULO_SEGUIMIENTO.test(info?.titulo ?? '')) q(`título «${info?.titulo}»; debe ser «Seguimiento del pronóstico con corte W..»`);
    if (seg && info?.corte !== seg.corte?.etiqueta) q(`corte ${info?.corte} ≠ el del seguimiento (${seg.corte?.etiqueta})`);
    const semanas = Array.isArray(info?.semanas) ? info.semanas : [];
    if (!semanas.length) q('sin semanas');
    let ordenFase = 0, iniPrevio = null, hEsperado = 1;
    for (const w of semanas) {
      const e = w.etiqueta ?? `semana ${w.semana}`;
      for (const k of ['fecha', 'inicio', 'error_pct']) {
        if (k in w) q(`${e} trae «${k}» (tabla anterior: ds legado como inicio o error contra el ajuste)`);
      }
      const f = FASES_SEGUIMIENTO.indexOf(w.fase);
      if (f < 0) { q(`${e}: fase «${w.fase}»`); continue; }
      if (f < ordenFase) q(`${e}: fase ${w.fase} después de una posterior (las fases van observado → seguimiento → pronóstico)`);
      else ordenFase = f;
      // Periodo oficial del boletín: domingo a sábado, consecutivo y el del calendario.
      if (!/^\d{4}-\d{2}-\d{2}$/.test(w.periodo_inicio ?? '') || !/^\d{4}-\d{2}-\d{2}$/.test(w.periodo_fin ?? '')) {
        q(`${e}: sin periodo oficial del boletín`);
      } else {
        const ini = Date.parse(`${w.periodo_inicio}T00:00:00Z`), fin = Date.parse(`${w.periodo_fin}T00:00:00Z`);
        if (fin - ini !== 6 * DIA) q(`${e}: periodo ${w.periodo_inicio}–${w.periodo_fin} no es de 7 días`);
        if (w.periodo_inicio !== inicioSemanaEpi(w.anio, w.semana)) {
          q(`${e}: periodo empieza ${w.periodo_inicio}; la semana ${w.semana} de ${w.anio} empieza ${inicioSemanaEpi(w.anio, w.semana)}`);
        }
        if (iniPrevio != null && ini - iniPrevio !== 7 * DIA) q(`${e}: no es la semana siguiente de la anterior`);
        iniPrevio = ini;
      }
      if (w.fase === 'observado') {
        for (const k of ['pronostico', 'diferencia', 'error_abs', 'estado', 'horizonte', ...CLAVES_MOTOR]) {
          if (k in w) q(`${e}: semana anterior al corte con «${k}»: el ajuste dentro de muestra no se presenta como validación`);
        }
        if (w.real === 0 && w.motivo_observado) q(`${e}: observación faltante convertida en cero`);
        continue;
      }
      if (w.corte !== info.corte) q(`${e}: corte ${w.corte} ≠ ${info.corte}`);
      if (w.horizonte !== hEsperado) q(`${e}: horizonte ${w.horizonte}; tras el corte debía ser ${hEsperado}`);
      hEsperado += 1;
      if (w.fase === 'seguimiento') {
        for (const k of CLAVES_MOTOR) if (k in w) q(`${e}: el seguimiento compara sólo el motor asignado, trae «${k}»`);
        if (w.estado === 'par') {
          if (!Number.isInteger(w.real) || !Number.isInteger(w.pronostico)) q(`${e}: par sin ambos lados enteros`);
          else {
            if (w.diferencia !== w.pronostico - w.real) q(`${e}: diferencia ${w.diferencia} ≠ pronóstico − observado`);
            if (w.error_abs !== Math.abs(w.pronostico - w.real)) q(`${e}: error_abs ${w.error_abs} ≠ |pronóstico − observado|`);
          }
          const n = pares.get(`${sinTilde(pad)}|${e}`);
          if (!n || n.pronostico !== w.pronostico || n.real !== w.real) q(`${e}: no es el par nacional de seguimiento_post_corte`);
        } else if (w.estado === 'ausente') {
          if (!String(w.motivo ?? '').trim()) q(`${e}: ausente sin motivo`);
          if (w.real != null && w.pronostico != null) q(`${e}: ausente con ambos lados (un par ausente no se completa)`);
          if ('diferencia' in w || 'error_abs' in w) q(`${e}: ausente con diferencia o error (se convirtió en un número)`);
        } else q(`${e}: estado «${w.estado}» (par o ausente)`);
      } else if (w.real != null) q(`${e}: semana de pronóstico con observado`);
    }
  }
  return out;
}

/**
 * El nacional por sexo: incremento neto del acumulado (con las revisiones de los estados),
 * rotulado; cobertura de 32 entidades en ambas semanas, semanas consecutivas; los ausentes
 * estatales aparte con su motivo; general = Casos_semana, sin forzar general = hombres + mujeres.
 * @returns {string[]} problemas
 */
export function problemasDeNacionalPorSexo(kb) {
  const out = [];
  const seg = kb?.seguimiento_post_corte;
  if (!seg) return ['seguimiento_post_corte ausente'];
  const def = seg.definiciones ?? {};
  if (def.sexo_agregado !== DEF_SEXO_AGREGADO) out.push(`definiciones.sexo_agregado = «${def.sexo_agregado}»; debe ser «${DEF_SEXO_AGREGADO}»`);
  if (!/Casos_semana/.test(def.general ?? '')) out.push('definiciones.general no declara Casos_semana');
  const agreg = Array.isArray(seg.agregacion_sexo) ? seg.agregacion_sexo : [];
  if (!agreg.length) out.push('agregacion_sexo vacía: no se documenta cómo se agrega el nacional por sexo');
  const porClave = new Map(agreg.map((a) => [`${a.semana_objetivo}|${sinTilde(a.padecimiento)}|${a.sexo}`, a]));
  for (const a of agreg) {
    const e = `agregacion_sexo ${a.semana_objetivo} ${a.padecimiento} ${a.sexo}`;
    if (a.definicion_real !== DEF_SEXO_AGREGADO) out.push(`${e}: sin el rótulo del incremento neto`);
    if (a.entidades_semana !== 32 || a.entidades_semana_previa !== 32) out.push(`${e}: cobertura ${a.entidades_semana_previa}/${a.entidades_semana}; debe ser 32/32`);
    if (a.semanas_consecutivas !== true) out.push(`${e}: semanas no consecutivas (${a.semana_previa} → ${a.semana_objetivo})`);
    if (a.neto != null && a.acumulado_semana != null && a.acumulado_semana_previa != null && a.neto !== a.acumulado_semana - a.acumulado_semana_previa) {
      out.push(`${e}: neto ${a.neto} no es la diferencia del acumulado nacional`);
    }
    if (a.real_publicado != null && a.real_publicado !== a.neto) {
      out.push(`${e}: se publicó ${a.real_publicado} y la diferencia del acumulado nacional es ${a.neto} (¿suma de incrementos estatales recortados?)`);
    }
  }
  let nAus = 0;
  for (const s of seg.semanas ?? []) {
    for (const [cohorte, c] of Object.entries(s.cohortes ?? {})) {
      nAus += c.ausentes ?? 0;
      for (const n of c.nacional ?? []) {
        const e = `${s.etiqueta} ${cohorte} nacional ${n.padecimiento} ${n.sexo}`;
        if (n.sexo === 'general') {
          if (!/Casos_semana/.test(n.definicion_real ?? '')) out.push(`${e}: el general no declara Casos_semana`);
          continue;
        }
        if (n.definicion_real !== DEF_SEXO_AGREGADO) out.push(`${e}: sin el rótulo «${DEF_SEXO_AGREGADO}»`);
        const a = porClave.get(`${s.etiqueta}|${sinTilde(n.padecimiento)}|${n.sexo}`);
        if (!a) out.push(`${e}: sin su fila en agregacion_sexo`);
        else if (a.neto !== n.real) out.push(`${e}: publicado ${n.real} ≠ incremento neto ${a.neto}`);
      }
    }
  }
  const aus = Array.isArray(seg.ausentes) ? seg.ausentes : [];
  if (aus.length !== nAus) out.push(`ausentes: ${aus.length} listados y ${nAus} contados en las semanas`);
  for (const a of aus) {
    const e = `ausente ${a.semana_objetivo} ${a.padecimiento} ${a.entidad} ${a.sexo}`;
    if (!String(a.motivo ?? '').trim()) out.push(`${e}: sin motivo`);
    if (a.real != null && a.pronostico != null) out.push(`${e}: con ambos lados`);
    if (a.real === 0) out.push(`${e}: convertido en cero`);
  }
  for (const m of kb?.prod_models ?? []) {
    if (!m.semana_validacion || m.sexo === 'general') continue;
    const agregado = m.entidad === 'Nacional' || /^region/i.test(m.entidad ?? '');
    if (agregado && m.definicion_realidad_validacion !== DEF_SEXO_AGREGADO) {
      out.push(`prod_models ${m.padecimiento} ${m.entidad} ${m.sexo}: la realidad no lleva el rótulo del incremento neto`);
    }
  }
  return out;
}

/** Vistas que presentan el seguimiento: el EpiBot (kb.js, app.js) y la página de validación. */
export const VISTAS_SEGUIMIENTO = ['epibot/js/kb.js', 'epibot/js/app.js', 'validacion_semanal.html'];
export const RE_MEZCLA_O_CALIFICACION = [
  [/Real vs Pron[oó]stico/, 'título de la tabla anterior (mezclaba ajuste y seguimiento)'],
  [/\|\s*Inicio\s*\|/, 'columna «Inicio» con el ds legado (no es el inicio del periodo)'],
  [/Precisi[oó]n \*\*(excelente|buena|moderada)\*\*/i, 'calificación automática de la precisión'],
  [/\b(EXCELENTE|BUENO|REGULAR|FALLO)\b/, 'veredicto automático'],
  [/= bueno\b|= fallo\b/i, 'semáforo de calificación'],
  [/[Cc]orredor de confianza|alta confianza/, 'la dispersión entre motores presentada como confianza'],
  [/Error acumulado/, 'error acumulado contra semanas del ajuste'],
  [/Semaforo por Entidad/, 'semáforo de calificaciones'],
];

/**
 * El código de las vistas no reintroduce la mezcla ni las calificaciones (comentarios incluidos
 * para el título anterior; las agujas son de texto visible).
 * @returns {string[]} problemas con archivo:línea
 */
export function problemasDeVistasSeguimiento(archivo, texto) {
  const out = [];
  String(texto ?? '').split('\n').forEach((linea, i) => {
    for (const [re, que] of RE_MEZCLA_O_CALIFICACION) {
      if (re.test(linea)) out.push(`${archivo}:${i + 1}: ${que} — «${linea.trim().slice(0, 90)}»`);
    }
  });
  if (archivo === 'validacion_semanal.html') {
    for (const req of [DEF_SEXO_AGREGADO, 'Pares ausentes y sus motivos', 'Nacional por sexo: definicion']) {
      if (!String(texto ?? '').includes(req)) out.push(`${archivo}: falta «${req}»`);
    }
  }
  return out;
}

// --- Indicador «Notificaciones previstas · agregado estatal neuro» (ronda W37, 14-oct-2026) ---
// Antes: stats.pronostico_total sumaba los totales por serie ya redondeados (171,525), el EpiBot lo
// recalculaba igual y lo llamaba «Pronóstico 52 sem» / «Pronóstico Nacional», y varias vistas
// llamaban «nacional» a la suma de los 32 estados. Ahora el backend lo calcula desde los yhat
// originales (171,524.0401 → 171,524) y los modelos nacionales conservan su pronóstico propio.

export const ROTULO_AGREGADO = 'Notificaciones previstas · agregado estatal neuro';
const PADS_NEURO = ['Alzheimer', 'Depresion', 'Parkinson'];
const redondeaUnaVez = (x) => Math.floor(x + 0.5);

/**
 * `knowledge.agregado_estatal_neuro`: denominador (96 series = 32 estados × 3, general), horizonte
 * de 52 pasos, suma original redondeada una vez, y los totales del EpiBot iguales a él.
 * @returns {string[]} problemas
 */
export function problemasDelAgregadoEstatal(kb) {
  const out = [];
  const ag = kb?.agregado_estatal_neuro;
  if (!ag) return ['agregado_estatal_neuro ausente: el indicador no tiene valor canónico del backend'];
  const q = (m) => out.push(`agregado_estatal_neuro: ${m}`);
  if (ag.rotulo !== ROTULO_AGREGADO) q(`rótulo «${ag.rotulo}»`);
  if (ag.series_incluidas !== 96 || ag.valores !== 96 * 52) q(`${ag.series_incluidas} series / ${ag.valores} valores (deben ser 96 / 4,992)`);
  if (ag.horizonte?.pasos !== 52) q(`horizonte de ${ag.horizonte?.pasos} pasos`);
  const seg = kb?.seguimiento_post_corte;
  if (seg && ag.corte !== seg.corte?.etiqueta) q(`corte ${ag.corte} ≠ ${seg.corte?.etiqueta}`);
  if (typeof ag.suma_original !== 'number' || !Number.isFinite(ag.suma_original)) q('sin suma original');
  else if (ag.valor_mostrado !== redondeaUnaVez(ag.suma_original)) {
    q(`valor mostrado ${ag.valor_mostrado} ≠ suma original ${ag.suma_original} redondeada una vez`);
  }
  if (!/96 series/.test(ag.denominador ?? '') || !/52 pasos/.test(ag.denominador ?? '')) q(`denominador «${ag.denominador}»`);
  const series = Array.isArray(ag.series) ? ag.series : [];
  const claves = new Set(series.map((s) => `${s.padecimiento}|${s.entidad}`));
  if (series.length !== 96 || claves.size !== 96) q(`${series.length} series listadas (${claves.size} distintas)`);
  if (series.some((s) => s.pasos !== 52 || !Number.isFinite(s.suma_original) || s.suma_original < 0)) q('una serie sin 52 pasos o con suma inválida');
  if (series.some((s) => s.entidad === 'Nacional' || /^region/i.test(s.entidad ?? ''))) q('incluye una serie nacional o regional');
  const sumaSeries = series.reduce((a, s) => a + s.suma_original, 0);
  if (Math.abs(sumaSeries - ag.suma_original) > 1e-6) q(`las series suman ${sumaSeries}, no ${ag.suma_original}`);
  const pp = ag.por_padecimiento ?? {};
  for (const p of PADS_NEURO) {
    const x = pp[p];
    if (!x || x.series !== 32) { q(`${p}: ${x?.series} estados (deben ser 32)`); continue; }
    if (x.valor_mostrado !== redondeaUnaVez(x.suma_original)) q(`${p}: valor ${x.valor_mostrado} ≠ ${x.suma_original} redondeada una vez`);
    const ps = kb?.stats?.por_pad?.[p];
    if (ps && ps.casos_futuro_total !== x.valor_mostrado) q(`stats.por_pad.${p}.casos_futuro_total ${ps.casos_futuro_total} ≠ ${x.valor_mostrado}`);
    for (const [sx, info] of Object.entries(ps?.por_sexo ?? {})) {
      const canon = ag.por_sexo?.[sx]?.por_padecimiento?.[p];
      if (!canon || info.casos_total !== canon.valor_mostrado || info.n_estados !== 32) {
        q(`stats.por_pad.${p}.por_sexo.${sx}.casos_total ${info.casos_total} no es el agregado de 32 estados (${canon?.valor_mostrado})`);
      }
    }
  }
  if (kb?.stats?.pronostico_total !== ag.valor_mostrado) q(`stats.pronostico_total ${kb?.stats?.pronostico_total} ≠ ${ag.valor_mostrado}`);
  return out;
}

/** El indicador no se recalcula en el frontend ni la suma de estados se llama «nacional». */
export const VISTAS_AGREGADO = ['epibot/js/kb.js', 'epibot/js/app.js', 'epibot/index.html'];
export const RE_AGREGADO_MAL = [
  [/stats\.pronostico_total\s*=(?!=)/, 'el frontend recalcula el indicador'],
  [/_fixForecastTotals/, 'recalcula los totales desde valores redondeados'],
  [/Pron(?:ó|\\u00f3)stico Nacional/, '«Pronóstico Nacional» para la suma de estados'],
  [/a nivel \*\*nacional\*\*[^\n]*casos_futuro_total|casos_futuro_total[^\n]*a nivel nacional/i, 'la suma de estados llamada nacional'],
  [/'Total nacional'/, 'la suma de estados llamada «Total nacional»'],
  [/Total nacional pronosticado\*\*/, 'la suma de estados llamada «Total nacional pronosticado»'],
  [/>Pronóstico 52 sem</, 'el indicador sin su rótulo ni denominador'],
];

export function problemasDeVistasAgregado(archivo, texto) {
  const out = [];
  String(texto ?? '').split('\n').forEach((linea, i) => {
    for (const [re, que] of RE_AGREGADO_MAL) {
      if (re.test(linea)) out.push(`${archivo}:${i + 1}: ${que} — «${linea.trim().slice(0, 90)}»`);
    }
  });
  if (archivo === 'epibot/index.html') {
    for (const req of [ROTULO_AGREGADO, 'id="statForecastDet"']) {
      if (!String(texto ?? '').includes(req)) out.push(`${archivo}: falta «${req}»`);
    }
  }
  return out;
}

// --- Portada y Dengue hasta W39 (cierre W39, 14-oct-2026) -------------------------------------
// `hero_series.json` no tenía generador y seguía en junio (semana 21: motor, total, curvas y un
// `smape` por padecimiento); la cifra fija del motor líder decía «29 % DeepAR»; `bento.json`
// (semana 21) seguía servido sin consumidor; el total de Dengue «52 sem» sumaba 50 pasos.

/**
 * @param {string} indexHtml  index.html de la raíz
 * @param {object|null} hero  hero_series.json (null si falta)
 * @param {object} kb         knowledge.json
 * @param {boolean} hayBento  si `bento.json` sigue publicado
 * @returns {string[]} problemas
 */
export function problemasDePortada(indexHtml, hero, kb, hayBento) {
  const out = [];
  const seg = kb?.seguimiento_post_corte || {};
  const corte = seg.corte?.etiqueta, ultima = seg.ultima_semana_observada?.etiqueta;
  if (!hero) out.push('hero_series.json ausente');
  else {
    if (hero.corte !== corte || hero.ultima_observada !== ultima) {
      out.push(`hero_series: corte ${hero.corte} / observado ${hero.ultima_observada}; el knowledge dice ${corte} / ${ultima}`);
    }
    if (/"smape"|"mase"/i.test(JSON.stringify(hero))) out.push('hero_series publica métricas de error');
    const wc = kb?.weekly_comparison || {};
    for (const s of hero.series || []) {
      const esperado = wc[s.pad]?.pronostico_52_pasos;
      if (s.casos !== esperado) out.push(`hero_series ${s.pad}: ${s.casos} casos ≠ 52 pasos desde el corte (${esperado})`);
      const nac = s.pad === 'Dengue' ? kb?.dengue?.motor_nacional
        : (kb?.prod_models || []).find((m) => m.padecimiento === s.pad && m.entidad === 'Nacional' && m.sexo === 'general')?.modelo_produccion;
      if (s.motor !== nac) out.push(`hero_series ${s.pad}: motor ${s.motor} ≠ modelo nacional ${nac}`);
    }
    if ((hero.series || []).length !== 4) out.push(`hero_series con ${(hero.series || []).length} series (deben ser 4)`);
  }
  const st = kb?.stats || {};
  const m = String(indexHtml ?? '').match(/id="b-motor-pct">([^<]*)<\/span>%<\/b><span>[^<]*<span id="b-motor">([^<]*)</);
  if (!m) out.push('index.html: sin la cifra del motor líder');
  else if (m[2] !== st.motor_ganador || Number(m[1]) !== Number(st.motor_ganador_pct)) {
    out.push(`index.html: motor líder fijo ${m[1]} % ${m[2]} ≠ knowledge ${st.motor_ganador_pct} % ${st.motor_ganador}`);
  }
  const dg = kb?.dengue;
  if (dg && dg.casos_futuro_nacional_52sem !== kb?.weekly_comparison?.Dengue?.pronostico_52_pasos) {
    out.push(`dengue.casos_futuro_nacional_52sem ${dg.casos_futuro_nacional_52sem} ≠ 52 pasos desde el corte (${kb?.weekly_comparison?.Dengue?.pronostico_52_pasos})`);
  }
  if (hayBento) out.push('bento.json sigue publicado (datos de la semana 21, sin consumidor)');
  return out;
}
