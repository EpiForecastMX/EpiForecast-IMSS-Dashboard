/**
 * Semanas no prospectivas (decisión del autor, 25-nov-2026): si el boletín de una semana ya era público al emitir el
 * pronóstico, el EpiBot la cuenta como observada pero no como prospectiva y da aparte el error de las prospectivas.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'fs';

const raiz = new URL('../../', import.meta.url);
globalThis.fetch = async (u) => {
  const s = String(u?.url ?? u);
  const m = s.match(/(publication\/[a-z0-9_]+\/vista\.json|assets\/boletin\/[^?]+\.json)/);
  const local = s.match(/(knowledge|zoom_series|resumen_padecimientos|comparacion_rondas)\.json/);
  const rel = m ? m[1] : (local ? `epibot/${local[1]}.json` : null);
  if (!rel || !existsSync(new URL(rel, raiz))) return { ok: false, json: async () => null };
  return { ok: true, json: async () => JSON.parse(readFileSync(new URL(rel, raiz), 'utf-8')) };
};
await import('../js/release_catalog.js');
const { soloProspectivas } = await import('../js/obesidad_kb.js');
const vista = (id) => JSON.parse(readFileSync(new URL(`publication/${id}/vista.json`, raiz), 'utf-8'));

test('asma: W42 ya era pública; sólo W43 es prospectiva (2,702 frente a 3,191, sMAPE 16.6 %)', () => {
  const v = vista('asma_j45'), x = v.series['nacional|mx|general'];
  const p = soloProspectivas(v, x, ['2026-W42']);
  assert.deepEqual([p.semanas, p.observado_total, p.pronostico_total, Math.round(p.smape * 10) / 10], [1, 2702, 3191, 16.6]);
  // Sin semanas excluidas, coincide con el sMAPE publicado de la vista.
  const todo = soloProspectivas(v, x, []);
  assert.equal(todo.semanas, x.oos.semanas);
  assert.ok(Math.abs(todo.smape - x.oos.smape) < 0.01, `${todo.smape} frente a ${x.oos.smape}`);
});

test('los nueve releases con semanas no prospectivas las declaran en el catálogo con su cronología', () => {
  const con = globalThis.EPI_CATALOGO.releases.filter((r) => r.no_prospectivas);
  assert.equal(con.length, 9);
  for (const r of con) {
    assert.ok(r.no_prospectivas.every((w) => /^\d{4}-W\d{2}$/.test(w)), r.id);
    const v = vista(r.id), x = v.series['nacional|mx|general'];
    const p = soloProspectivas(v, x, r.no_prospectivas);
    assert.equal(p.semanas, x.oos.semanas - r.no_prospectivas.length, r.id);
  }
});

test('la respuesta del EpiBot sobre asma separa la semana no prospectiva', async () => {
  const kb = await import('../js/kb.js');
  await kb.loadKnowledge();
  const r = await kb.answerWithTrace('pronóstico de asma nacional');
  const texto = JSON.stringify(r);
  assert.match(texto, /sMAPE/, 'la ficha del EpiBot trae el desempeño');
  assert.match(texto, /2026-W42 ya era pública al emitir el pronóstico/);
  assert.match(texto, /Sólo las prospectivas \(1\): sMAPE \*\*16\.6 %\*\*/);
});
