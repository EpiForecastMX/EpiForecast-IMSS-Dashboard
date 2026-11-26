/**
 * Carga diferida de zoom_series.json (mesa de la plataforma, 25-nov-2026, Codex Astra): no se pide al abrir; se comparte
 * la petición y, si falla, la siguiente consulta la reintenta.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'fs';

const raiz = new URL('../../', import.meta.url);
const pedidos = [];
let fallaZoom = 1;
globalThis.requestIdleCallback = () => {}; // el navegador «nunca» queda libre: sólo las consultas la piden
globalThis.fetch = async (u) => {
  const s = String(u?.url ?? u);
  pedidos.push(s);
  if (/zoom_series\.json/.test(s) && fallaZoom-- > 0) return { ok: false, json: async () => null };
  const m = s.match(/(publication\/[a-z0-9_]+\/vista\.json|assets\/boletin\/[^?]+\.json)/);
  const local = s.match(/(knowledge|zoom_series|resumen_padecimientos|comparacion_rondas)\.json/);
  const rel = m ? m[1] : (local ? `epibot/${local[1]}.json` : null);
  if (!rel || !existsSync(new URL(rel, raiz))) return { ok: false, json: async () => null };
  return { ok: true, json: async () => JSON.parse(readFileSync(new URL(rel, raiz), 'utf-8')) };
};
const kb = await import('../js/kb.js');

test('abrir no descarga zoom_series; una consulta de un original la pide, y tras un fallo se reintenta', async () => {
  await kb.loadKnowledge();
  assert.equal(pedidos.filter((p) => /zoom_series/.test(p)).length, 0, 'no se pide al abrir');
  const [a, b] = [kb.cargaZoom(), kb.cargaZoom()];
  assert.equal(a, b, 'la petición se comparte');
  assert.equal(await a, null, 'el primer intento falla (simulado)');
  const r = JSON.stringify(await kb.answerWithTrace('dengue en Veracruz'));
  assert.equal(pedidos.filter((p) => /zoom_series/.test(p)).length, 2, 'la consulta reintenta');
  assert.match(r, /Dengue/);
  assert.ok((await kb.getData()).zoom_series, 'quedó cargado');
});
