// Ámbitos (nacional, macrorregión, entidad) y sexo del radar del boletín. Lógica pura, sin DOM: la usan
// curves.js, pronostico_vista.mjs y las pruebas. Las macrorregiones son las de EpiForecast-MX
// (config/geografia/entidades_mx.csv del backend), no regiones oficiales del SINAVE: el boletín no las imprime.
// Una cifra regional es la suma de las cifras estatales impresas y queda como hueco si falta cualquiera.

/** Entidades en orden INEGI (clave = posición + 1), con el nombre que usa el índice del histórico. */
export const ENTIDADES = Object.freeze([
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Coahuila', 'Colima', 'Chiapas',
  'Chihuahua', 'Ciudad de México', 'Durango', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'México',
  'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo',
  'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
]);

export const REGIONES = Object.freeze([
  { id: 'norte', nombre: 'Norte', claves: ['02', '03', '05', '08', '10', '19', '25', '26', '28'] },
  { id: 'occidente', nombre: 'Occidente', claves: ['01', '06', '11', '14', '16', '18', '24', '32'] },
  { id: 'centro', nombre: 'Centro', claves: ['09', '13', '15', '17', '21', '22', '29'] },
  { id: 'sureste', nombre: 'Sureste', claves: ['04', '07', '12', '20', '23', '27', '30', '31'] },
].map(Object.freeze));

export const SEXOS = Object.freeze([
  { id: 'general', nombre: 'General' },
  { id: 'hombres', nombre: 'Hombres' },
  { id: 'mujeres', nombre: 'Mujeres' },
]);

export const NACIONAL = Object.freeze({ tipo: 'nacional' });
export const clave = (i) => String(i + 1).padStart(2, '0');

/** ¿El orden de estados del índice es el orden INEGI esperado? Si no, no se arman regiones. */
export function estadosCompatibles(estados) {
  return Array.isArray(estados) && estados.length === ENTIDADES.length && estados.every((s, i) => s === ENTIDADES[i]);
}

/** Texto de URL («nacional», «region:norte», «estado:09») a ámbito; lo inválido es nacional. */
export function parseAmbito(texto) {
  const t = String(texto ?? '').trim().toLowerCase();
  const r = /^region:([a-z]+)$/.exec(t);
  if (r && REGIONES.some((x) => x.id === r[1])) return { tipo: 'region', id: r[1] };
  const e = /^estado:(\d{2})$/.exec(t);
  if (e) { const i = Number(e[1]) - 1; if (i >= 0 && i < ENTIDADES.length) return { tipo: 'estado', i }; }
  return NACIONAL;
}

export function serializaAmbito(a) {
  if (a?.tipo === 'region') return `region:${a.id}`;
  if (a?.tipo === 'estado') return `estado:${clave(a.i)}`;
  return 'nacional';
}

export const parseSexo = (texto) => (SEXOS.some((s) => s.id === texto) ? texto : 'general');

export function region(id) { return REGIONES.find((r) => r.id === id) ?? null; }

/** Índices (posición en index.states) de las entidades de una región. */
export function indicesRegion(id) { return (region(id)?.claves ?? []).map((c) => Number(c) - 1); }

export function nombreAmbito(a) {
  if (a?.tipo === 'region') { const r = region(a.id); return `Región ${r.nombre}`; }
  if (a?.tipo === 'estado') return ENTIDADES[a.i];
  return 'Nacional';
}

/** Rótulo largo de una región para títulos y CSV. */
export function rotuloRegion(id) {
  const r = region(id);
  return `Región ${r.nombre} (suma de ${r.claves.length} entidades)`;
}

/** Clave de serie de una vista publicada (publication/<id>/vista.json). */
export function claveVista(a, sexo = 'general') {
  const s = parseSexo(sexo);
  if (a?.tipo === 'region') return `region|${a.id}|${s}`;
  if (a?.tipo === 'estado') return `estado|${clave(a.i)}|${s}`;
  return `nacional|mx|${s}`;
}

/**
 * Suma regional de celdas estatales. `celdas` son las cifras impresas de las 32 entidades (o null si el bloque
 * no tiene desglose); `numero` convierte una celda en valor (celdas.mjs). Devuelve { valor, faltan, negativos }:
 * valor es null si alguna entidad de la región no tiene valor comparable o imprime una cifra negativa.
 */
export function sumaRegion(celdas, id, numero) {
  const idx = indicesRegion(id);
  if (!Array.isArray(celdas) || !idx.length) return { valor: null, faltan: idx.map((i) => ENTIDADES[i]), negativos: [] };
  const faltan = [], negativos = [];
  let total = 0;
  for (const i of idx) {
    const v = numero(celdas[i]);
    if (v === null || v === undefined) faltan.push(ENTIDADES[i]);
    else if (v < 0) negativos.push(`${ENTIDADES[i]} (${v})`);
    else total += v;
  }
  return { valor: faltan.length || negativos.length ? null : total, faltan, negativos };
}
