/**
 * Fichas de cita (plan canónico 2.5, escalón 2; acta de la mesa de fichas clínicas del 26-nov-2026).
 *
 *   node scripts/fichas_cita.mjs archiva   descarga cada fuente, guarda su texto en fichas/archivo/<id>.txt y SHA256SUMS
 *   node scripts/fichas_cita.mjs verifica  comprueba con red que cada pasaje sigue en la página viva y avisa de las caducadas
 *
 * `archiva` sólo se corre al dar de alta una fuente: el archivo congelado es la referencia del criterio 1 del acta (cada
 * oración del pasaje es subcadena de la copia archivada). `verifica` va en el paso semanal (criterio 5) y no corre en CI.
 */
import { createHash } from 'crypto';
import { readFileSync, writeFileSync } from 'fs';
import { FUENTES_CITA, FICHAS_CITA, textoDeHtml, normalizaFuente, oracionesDe } from '../js/fichas_cita.js';

const raiz = new URL('../fichas/archivo/', import.meta.url);
const descarga = async (url) => {
  const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (EpiBot fichas de cita)' }, signal: AbortSignal.timeout(30000) });
  if (r.status !== 200) throw new Error(`${url}: HTTP ${r.status}`);
  return r.text();
};

const orden = process.argv[2];
if (orden === 'archiva') {
  const sumas = [];
  for (const [id, f] of Object.entries(FUENTES_CITA)) {
    const texto = textoDeHtml(await descarga(f.url));
    writeFileSync(new URL(`${id}.txt`, raiz), texto + '\n');
    const h = createHash('sha256').update(texto + '\n').digest('hex');
    sumas.push(`${h}  ${id}.txt`);
    console.log(`${id}: ${texto.length} caracteres, sha256 ${h}`);
  }
  writeFileSync(new URL('SHA256SUMS', raiz), sumas.join('\n') + '\n');
} else if (orden === 'verifica') {
  let fallos = 0;
  const hoy = new Date().toISOString().slice(0, 10);
  const vivas = {};
  for (const [id, f] of Object.entries(FUENTES_CITA)) {
    try { vivas[id] = normalizaFuente(textoDeHtml(await descarga(f.url))); } catch (e) { vivas[id] = null; console.log(`FALLA  ${id}: ${e.message}`); fallos++; }
  }
  for (const c of FICHAS_CITA) {
    const viva = vivas[c.fuente];
    const faltan = viva ? oracionesDe(c).filter((o) => !viva.includes(normalizaFuente(o))) : ['(página no disponible)'];
    const caduca = c.caduca <= hoy;
    if (faltan.length || caduca) fallos++;
    console.log(`${faltan.length || caduca ? 'FALLA' : '  ok '}  ${c.id}${caduca ? ` (caducó el ${c.caduca})` : ''}${faltan.length ? `: ya no está «${faltan[0].slice(0, 60)}…»` : ''}`);
  }
  console.log(fallos ? `${fallos} ficha(s) o fuente(s) con fallo: retirar (activa: false) o renovar.` : 'Todas las fichas siguen en su fuente y vigentes.');
  process.exit(fallos ? 1 : 0);
} else {
  console.error('Uso: node scripts/fichas_cita.mjs archiva|verifica');
  process.exit(2);
}
