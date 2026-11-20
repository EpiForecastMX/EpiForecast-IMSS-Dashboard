// Categorías del boletín que EpiForecast-MX no puede modelar (decisión del autor, alta_b44, 20-nov-2026).
// Única fuente de los rótulos y explicaciones por grupo: la usan el radar (radar.js), la página
// no_modelables.html (scripts/no_modelables_pagina.mjs), el EpiBot (radar_boletin.js) y el corpus RAG.
// El motivo medido de cada fila viaja en la foto del radar (`reason` y `no_modelable.grupo` de data.json).

export const ESTADO_NO_MODELABLE = 'No modelable';
export const PAGINA_NO_MODELABLES = 'no_modelables.html';

export const GRUPOS_NO_MODELABLES = Object.freeze({
  solo_nacional: Object.freeze({
    orden: 1,
    etiqueta: 'Sin desglose estatal',
    resumen: 'sin desglose estatal',
    explicacion: 'Los pronósticos de EpiForecast-MX se construyen con series por entidad federativa y el total nacional ' +
      'sale de sumarlas. Estas categorías sólo aparecen en el resumen nacional de notificación inmediata del boletín, ' +
      'sin cifras por entidad, así que no existen las series que el método necesita.',
  }),
  sin_casos: Object.freeze({
    orden: 2,
    etiqueta: 'Casos insuficientes o no publicados',
    resumen: 'con casos insuficientes o no publicados en el cuadro',
    explicacion: 'Con acumulados vacíos o de tres casos o menos en todo el país, la serie es casi toda cero. La prueba ' +
      'única de 2025 compara errores relativos y, entre ceros, ese error no está definido; el control estacional sólo ' +
      'repetiría ceros. En sarampión y paludismo por P. falciparum el guion del cuadro no significa ausencia de casos: ' +
      'es una cifra que el cuadro no publica.',
  }),
  sem_menos_uno: Object.freeze({
    orden: 3,
    etiqueta: 'Total imputado en el año de prueba',
    resumen: 'con total imputado en el año de prueba',
    explicacion: 'La regla del proyecto exige que el año de la prueba única, 2025, no tenga totales imputados. En estas ' +
      'categorías el boletín imprimió «-1» como casos de la semana en alguna entidad; esa celda no es un conteo y su ' +
      'semana tendría que imputarse.',
  }),
  sin_pliegues: Object.freeze({
    orden: 4,
    etiqueta: 'Historia insuficiente',
    resumen: 'con historia insuficiente',
    explicacion: 'Su cuadro propio existe sólo desde 2025 o 2026. La política más corta del proyecto exige al menos un ' +
      'año completo de historia antes del año de prueba para elegir un modelo y probarlo una sola vez; con estas ' +
      'series no lo hay.',
  }),
});

export const POR_QUE_SIN_PRONOSTICO = 'EpiForecast-MX sólo publica un pronóstico cuando la serie permite elegir un ' +
  'modelo con datos anteriores y probarlo una sola vez frente al control estacional. Estas categorías no cumplen una ' +
  'condición técnica medida, y ninguna regla se relajó para incluirlas: no tienen modelo validado ni pronóstico ' +
  'publicado. El radar del boletín les muestra un pronóstico exploratorio, no validado, sin prueba de desempeño ni ' +
  'intervalos. Sus cifras son las que imprime el boletín, tal como aparecen en el radar.';

/** Grupo de una fila del radar, o null si no es una categoría no modelable bien formada. */
export function grupoNoModelable(e) {
  if (e?.status !== ESTADO_NO_MODELABLE) return null;
  const g = e.no_modelable?.grupo;
  return Object.hasOwn(GRUPOS_NO_MODELABLES, g) ? g : null;
}

/** Filas no modelables de la foto, por grupo y nombre. Falla cerrado si alguna no declara un grupo conocido. */
export function filasNoModelables(diseases) {
  const filas = diseases.filter((e) => e.status === ESTADO_NO_MODELABLE);
  for (const e of filas) {
    if (!grupoNoModelable(e)) throw new Error(`categoría no modelable sin grupo conocido: ${e.id}`);
    if (e.platform_id) throw new Error(`categoría no modelable con release: ${e.id}`);
    if (typeof e.reason !== 'string' || !e.reason.trim()) throw new Error(`categoría no modelable sin motivo: ${e.id}`);
  }
  const orden = (e) => GRUPOS_NO_MODELABLES[e.no_modelable.grupo].orden;
  return filas.sort((a, b) => orden(a) - orden(b) || nombreLimpio(a.name).localeCompare(nombreLimpio(b.name), 'es'));
}

/** Nombre impreso sin marcas tipográficas del cuadro («^Miasis», «•Sarampión») ni espacios dobles. */
export function nombreLimpio(nombre) {
  return String(nombre ?? '').replace(/^[\^•]+/, '').replace(/\s+/g, ' ').trim();
}

/** Código impreso de una categoría («B55.0», «A33», «T17.2 - T17.3») como palabra completa de la consulta. */
export function codigoEnConsulta(codigo, q) {
  const c = String(codigo ?? '').toLowerCase().replace(/[^a-z0-9.]+/g, ' ').trim();
  if (!/^[a-z][0-9]/.test(c)) return false;
  const qq = ` ${String(q ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9.]+/g, ' ').replace(/\.(?![0-9])/g, ' ').trim()} `;
  // La consulta puede llegar ya normalizada sin puntos («b55 0»).
  return qq.includes(` ${c} `) || qq.includes(` ${c.replace(/\./g, ' ')} `);
}

const normaliza = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Categorías no modelables que la consulta pide por su nombre impreso completo o por su código. Un nombre contenido en otro
 * más largo sólo cuenta si también aparece fuera de él («rubéola y síndrome de rubéola congénita» pide las dos).
 */
export function noModelablesEnConsulta(q, diseases, { codigos = true } = {}) {
  const filas = diseases.filter((e) => e.status === ESTADO_NO_MODELABLE && !e.platform_id)
    .map((e) => ({ e, n: normaliza(nombreLimpio(e.name)) }));
  const qq = ` ${normaliza(q)} `;
  const completas = filas.filter((x) => x.n.length > 3 && qq.includes(` ${x.n} `));
  const fuera = (x) => {
    let resto = qq;
    for (const o of completas) if (o !== x && o.n.length > x.n.length && o.n.includes(x.n)) resto = resto.split(` ${o.n} `).join('  ');
    return resto.includes(` ${x.n} `);
  };
  const porNombre = completas.filter(fuera).map((x) => x.e);
  const porCodigo = codigos ? filas.filter((x) => !porNombre.includes(x.e) && codigoEnConsulta(x.e.code, q)).map((x) => x.e) : [];
  return [...porNombre, ...porCodigo];
}
