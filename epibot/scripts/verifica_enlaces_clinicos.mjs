/**
 * Comprueba con red que cada enlace oficial de js/clinica.js responde 200 (plan canónico 2.5, escalón 1). Sale con código 1 si
 * alguno falla. No corre en CI (necesita red): úsalo en el paso semanal con `npm run clinica:enlaces`.
 */
import { ENLACES_OFICIALES } from '../js/clinica.js';

const extra = [['Secretaría de Salud', 'https://www.gob.mx/salud'], ['MedlinePlus en español', 'https://medlineplus.gov/spanish/']];
let fallos = 0;
for (const [nombre, url] of [...ENLACES_OFICIALES.map(([, n, u]) => [n, u]), ...extra]) {
  let estado;
  try {
    const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (EpiBot enlaces)' }, signal: AbortSignal.timeout(20000) });
    estado = r.status;
  } catch (e) { estado = `error: ${e.message}`; }
  const ok = estado === 200;
  if (!ok) fallos++;
  console.log(`${ok ? '  ok ' : 'FALLA'}  ${estado}  ${nombre}  ${url}`);
}
console.log(fallos ? `${fallos} enlace(s) con fallo.` : 'Todos los enlaces responden 200.');
process.exit(fallos ? 1 : 0);
