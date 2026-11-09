#!/usr/bin/env node
/**
 * Nota estática de picos heredados en la página de cada release publicado.
 *   node epibot/scripts/picos_heredados.mjs --check   (falla si alguna página no coincide)
 *   node epibot/scripts/picos_heredados.mjs --write   (reescribe sólo los párrafos de la nota)
 * La nota va justo después del primer párrafo de «Qué significa y qué no».
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { htmlPico, picosHeredados } from './lib/picos_heredados.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const NOTA = /^[ \t]*<p class="pico-heredado"[^\n]*<\/p>\n/gm;
const ANCLA = /(<h3>Qué significa y qué no<\/h3>\n[ \t]*<p>[^\n]*<\/p>\n)/;

export function paginaEsperada(html, picos) {
  const limpio = html.replace(NOTA, '');
  if (!picos.length) return limpio;
  const m = limpio.match(ANCLA);
  if (!m) throw new Error('sin el bloque «Qué significa y qué no»');
  const sangria = m[1].match(/\n([ \t]*)<p>/)[1];
  return limpio.replace(ANCLA, `$1${picos.map((p) => `${sangria}${htmlPico(p)}\n`).join('')}`);
}

export function revisa(root = ROOT, escribe = false) {
  const errores = [];
  const resumen = {};
  for (const id of readdirSync(resolve(root, 'publication')).sort()) {
    const vista = resolve(root, 'publication', id, 'vista.json');
    const pagina = resolve(root, `${id}.html`);
    if (!existsSync(vista) || !existsSync(pagina)) continue;
    const picos = picosHeredados(JSON.parse(readFileSync(vista, 'utf-8')));
    resumen[id] = picos.length;
    const html = readFileSync(pagina, 'utf-8');
    const esperado = paginaEsperada(html, picos);
    if (esperado === html) continue;
    if (escribe) writeFileSync(pagina, esperado);
    else errores.push(`${id}.html: la nota de picos heredados no coincide con su vista`);
  }
  return { errores, resumen };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const escribe = process.argv.includes('--write');
  const { errores, resumen } = revisa(ROOT, escribe);
  for (const [id, n] of Object.entries(resumen)) if (n) console.log(`${id}: ${n} pico(s) heredado(s)`);
  if (errores.length) {
    console.error(errores.join('\n'));
    process.exit(1);
  }
}
