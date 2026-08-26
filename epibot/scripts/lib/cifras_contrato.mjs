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
  galeria: 444, // gráficos publicados (333 neuro + 111 dengue)
};

/** Motores elegibles por cohorte. «Motor» es familia algorítmica, nunca una serie. */
export const MOTORES = {
  neuro: ['Prophet', 'DeepAR', 'Ensemble', 'Stacking'],
  dengue: ['Prophet', 'DeepAR', 'NBGLM'],
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

  // Dengue: 99 series y sólo motores elegibles, con NBGLM presente.
  const d = kb?.dengue ?? {};
  const ddm = d.dist_motor ?? {};
  const sumaDengue = Object.values(ddm).reduce((a, b) => a + b, 0);
  if (sumaDengue !== VOCABULARIO.dengue) {
    problemas.push(`dengue.dist_motor suma ${sumaDengue}; debe sumar ${VOCABULARIO.dengue}`);
  }
  for (const m of Object.keys(ddm)) {
    if (!MOTORES.dengue.includes(m)) {
      problemas.push(`dengue.dist_motor trae «${m}», no elegible para dengue (los árboles no extrapolan)`);
    }
  }
  if (!Object.prototype.hasOwnProperty.call(ddm, 'NBGLM')) {
    problemas.push('dengue.dist_motor sin NBGLM: es la huella de una selección anterior al selector vigente');
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
    if (Array.isArray(nodo)) return nodo.forEach((v) => anda(v, clave, true));
    if (nodo && typeof nodo === 'object') {
      for (const [k, v] of Object.entries(nodo)) {
        if (k.startsWith('_')) {
          exentos++;
          continue;
        }
        anda(v, k, false);
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
