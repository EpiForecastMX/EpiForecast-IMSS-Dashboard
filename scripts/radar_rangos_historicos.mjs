#!/usr/bin/env node
/**
 * radar_rangos_historicos.mjs — años que cubre cada clasificación histórica del archivo del radar (25-nov-2026).
 *
 * Mesa de la plataforma (Hydrogen): el buscador de curvas mostraba nueve veces seguidas «Infección asociada a la atención de la
 * salud · S/C · clasificación histórica», porque el OCR de distintos años dejó variantes del nombre que nombres.mjs unifica.
 * El rango de años las distingue. Las clasificaciones históricas son archivo cerrado (no reciben semanas nuevas), así que el
 * archivo es estático; `--check` falla si falta alguna o si un rango ya no coincide con su serie.
 *
 * Uso: node scripts/radar_rangos_historicos.mjs [--check]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HIST = resolve(RAIZ, 'assets/boletin/history');
const SALIDA = resolve(HIST, 'rangos_historicos.json');

export function rangos() {
  const index = JSON.parse(readFileSync(resolve(HIST, 'index.json'), 'utf8'));
  const out = {};
  for (const c of index.categories.filter((x) => x.historical)) {
    const s = JSON.parse(readFileSync(resolve(RAIZ, index.series[c.id].path.replace(/^\//, '')), 'utf8'));
    const sem = s.points.filter((p) => Number.isInteger(p.y) && Number.isInteger(p.w)).map((p) => p.y * 100 + p.w).sort((x, y) => x - y);
    if (!sem.length) throw new Error(`${c.id}: serie sin puntos`);
    const txt = (k) => `${Math.floor(k / 100)}-W${String(k % 100).padStart(2, '0')}`;
    out[c.id] = { desde: txt(sem[0]), hasta: txt(sem.at(-1)), semanas: new Set(sem).size };
  }
  return { schema: 'radar_rangos_historicos.v2', rangos: Object.fromEntries(Object.entries(out).sort()) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const texto = `${JSON.stringify(rangos(), null, 1)}\n`;
  if (process.argv.includes('--check')) {
    let actual = '';
    try { actual = readFileSync(SALIDA, 'utf8'); } catch { /* falta */ }
    if (actual !== texto) { console.error('[rangos] rangos_historicos.json desactualizado: ejecute node scripts/radar_rangos_historicos.mjs'); process.exit(1); }
    console.log('[rangos] al día');
  } else { writeFileSync(SALIDA, texto); console.log('[rangos] escrito'); }
}
