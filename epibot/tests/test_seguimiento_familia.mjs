/**
 * Seguimiento elíptico entre bloques hermanos con la foto del radar cargada, como en el navegador: tras
 * «hepatitis A en Jalisco mujeres», «¿y la C?» conserva Jalisco y mujeres. Sin el radar, la búsqueda por primera
 * palabra («hepatitis» → hepatitis vírica B, sin publicar) no se ve y la prueba pasaría con el error (preview 97).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

const raiz = new URL('../../', import.meta.url);
globalThis.fetch = async (u) => {
  const s = String(u);
  const rel = s.includes('knowledge.json') ? 'epibot/knowledge.json' : s.replace(/^(\.\.\/)+/, '').replace(/^\/+/, '').replace(/\?.*$/, '');
  try {
    const txt = readFileSync(new URL(rel, raiz), 'utf-8');
    return { ok: true, json: async () => JSON.parse(txt) };
  } catch { return { ok: false, json: async () => null }; }
};
const kb = await import('../js/kb.js');
const d = await kb.loadKnowledge();
await d.obesidad_pendiente;
await new Promise((r) => setTimeout(r, 50));

async function conversa(...qs) {
  kb._resetContext();
  let r;
  for (const q of qs) r = await kb.answerWithTrace(q);
  kb._resetContext();
  return String(r.response ?? '');
}

test('la foto del radar está cargada (si no, la prueba no reproduce el navegador)', () => {
  assert.ok(kb.getData().radar_boletin, 'radar_boletin');
});

test('hepatitis A en Jalisco mujeres → «¿y la C?» conserva estado y sexo', async () => {
  const md = await conversa('pronóstico de hepatitis A en Jalisco mujeres', '¿y la C?');
  assert.match(md, /HEPATITIS_C_B17:\{"tipo":"serie","estado":"Jalisco","sexo":"mujeres"/);
  assert.match(md, /Hepatitis vírica C \(B17\.1, B18\.2\) · Jalisco · Mujeres/);
});

test('hepatitis C en Sonora hombres → «¿y las otras?» conserva estado y sexo', async () => {
  const md = await conversa('hepatitis C en Sonora hombres', '¿y las otras?');
  assert.match(md, /OTRAS_HEPATITIS_B17:\{"tipo":"serie","estado":"Sonora","sexo":"hombres"/);
});

test('displasia leve en Jalisco → «¿y la severa?» conserva el estado (bloque sin sexo)', async () => {
  const md = await conversa('displasia cervical leve en Jalisco', '¿y la severa?');
  assert.match(md, /DISPLASIA_SEVERA_N87:\{"tipo":"serie","estado":"Jalisco"/);
});

test('desnutrición leve → «¿y la severa?» no da cifras de un bloque sin pronóstico', async () => {
  const md = await conversa('desnutrición leve en Jalisco', '¿y la severa?');
  assert.doesNotMatch(md, /DESNUTRICION_LEVE_E441|casos pronosticados|Pronóstico \*\*congelado\*\*/);
});

test('«¿y la B?» tras hepatitis A no hereda cifras', async () => {
  const md = await conversa('hepatitis A en Jalisco mujeres', '¿y la B?');
  assert.doesNotMatch(md, /HEPATITIS_A_B15|Pronóstico \*\*congelado\*\*/);
});
