/**
 * build_resumen_padecimientos.mjs — resumen nacional ligero de los padecimientos publicados del runner, para que el EpiBot
 * responda «¿qué enfermedades van al alza?» sin descargar las 148 vistas (unos 71 MB). Rediseño conversacional, 24-nov-2026.
 *
 * Sale de las mismas vistas publicadas y con las mismas reglas que la respuesta llana (js/resumen_llano.js). Los
 * padecimientos sensibles (lesiones autoinfligidas, violencia, VIH, intoxicación) no entran: nunca se listan en un ranking.
 *
 * Uso: node scripts/build_resumen_padecimientos.mjs          (escribe resumen_padecimientos.json)
 *      node scripts/build_resumen_padecimientos.mjs --check  (falla si el archivo no coincide con las vistas)
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..', '..');
const salida = join(aqui, '..', 'resumen_padecimientos.json');

const { RELEASES } = await import('../js/release_config.js');
const { indicadores, confiabilidad } = await import('../js/resumen_llano.js');

const filas = [];
let corte = null;
for (const r of RELEASES) {
  if (r.sensible) continue;
  const ruta = join(raiz, 'publication', r.id, 'vista.json');
  if (!existsSync(ruta)) continue;
  const v = JSON.parse(readFileSync(ruta, 'utf-8'));
  const x = v.series?.['nacional|mx|general'];
  if (!x) continue;
  const ind = indicadores(v, x);
  if (!ind || ind.F4 == null) continue;
  const control = !!v.caida_al_control || v.portafolio_igual_al_control === true;
  corte = corte && corte > ind.ultimo ? corte : ind.ultimo;
  // Por estado (serie General): [O4, F4, tendencia] para el ranking dentro de un estado («¿qué sube en Jalisco?»).
  const estados = {};
  for (const y of Object.values(v.series)) {
    if (y.nivel !== 'estado' || y.sexo !== 'general') continue;
    const e = indicadores(v, y);
    if (e && e.F4 != null) estados[y.nombre] = [Math.round(e.O4), Math.round(e.F4), e.tendencia];
  }
  filas.push({
    id: r.id, nombre: r.nombre, consulta: r.consultaVisible || r.consulta, pagina: r.pagina, estados,
    O4: Math.round(ind.O4), O4py: ind.O4py == null ? null : Math.round(ind.O4py), F4: Math.round(ind.F4),
    delta: ind.delta == null ? null : Math.round(ind.delta * 1000) / 1000, tendencia: ind.tendencia,
    ytd: Math.round(ind.ytd), ytdPrevio: ind.ytdPrevio == null ? null : Math.round(ind.ytdPrevio),
    confiabilidad: confiabilidad(v, x, control).nivel, control, ultimo: ind.ultimo,
  });
}
filas.sort((a, b) => a.id.localeCompare(b.id));
// Una línea por padecimiento: diff legible y archivo compacto.
const json = `{"schema":"resumen_padecimientos.v1","corte":${JSON.stringify(corte)},"padecimientos":[\n${filas.map((f) => JSON.stringify(f)).join(',\n')}\n]}\n`;
if (process.argv.includes('--check')) {
  const actual = existsSync(salida) ? readFileSync(salida, 'utf-8') : '';
  if (actual !== json) {
    console.error('resumen_padecimientos.json no coincide con las vistas publicadas: corre «npm run resumen:build».');
    process.exit(1);
  }
  console.log(`resumen_padecimientos.json al día (${filas.length} padecimientos, corte ${corte}).`);
} else {
  writeFileSync(salida, json);
  console.log(`resumen_padecimientos.json: ${filas.length} padecimientos, corte ${corte}.`);
}
