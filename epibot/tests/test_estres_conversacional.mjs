/**
 * Prueba de estrés del EpiBot (rediseño conversacional, 24-nov-2026): 613 preguntas realistas escritas por simuladores de
 * usuarios (ciudadanos, periodistas, padres, médicos, epidemiólogos, funcionarios, viajeros, adultos mayores, escépticos),
 * incluida una batería ciega que no se usó para ajustar. Fija pisos de calidad: ninguna crisis falsa, ningún texto roto,
 * ninguna respuesta de la cohorte neuro para preguntas ajenas y una proporción mínima de respuestas limpias.
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
Math.random = () => 0.42;
const kb = await import('../js/kb.js');
await kb.loadKnowledge();
const carga = (n) => JSON.parse(readFileSync(new URL(`./fixtures/estres/${n}.json`, import.meta.url), 'utf-8'));
const BATERIAS = { ciudadanos: carga('ciudadanos'), profesionales: carga('profesionales'), ciega: carga('ciega'), coloquial: carga('coloquial') };

async function corre(item) {
  kb._resetContext();
  let r = { response: null, handler: null };
  for (const t of item.turnos) r = await kb.answerWithTrace(t);
  kb._resetContext();
  return { handler: r.handler, md: String(r.response ?? '') };
}
const arriba = (md) => md.split('<!--DETALLE-->')[0].replace(/<!--[\s\S]*?-->/g, '');
const NEURO = /agregado estatal neuro|333 modelos|cohorte neurol[oó]gica|9 modelos de producci[oó]n/;

for (const [nombre, items] of Object.entries(BATERIAS)) {
  test(`estrés (${nombre}, ${items.length} preguntas): sin crisis falsas, texto roto ni cifras neuro ajenas, y piso de calidad`, async () => {
    const malos = [];
    let limpias = 0;
    for (const it of items) {
      const { handler, md } = await corre(it);
      const a = arriba(md);
      const crisisFalsa = /Lamento que estés|Sigo aquí contigo/.test(md);
      const roto = /undefined|NaN|\[object|\bnull\b/.test(a);
      const neuro = NEURO.test(a) && !/depresi|parkinson|alzheimer|neuro|modelo|motor/i.test(it.turnos.join(' '));
      if (crisisFalsa || roto || neuro) malos.push(`${handler} | ${it.turnos.join(' → ')}`);
      if (md && !/No entendí bien|No reconozco algunos/.test(md) && !crisisFalsa && !roto && !neuro) limpias++;
    }
    assert.deepEqual(malos, [], `${malos.length} respuestas inaceptables`);
    const piso = nombre === 'ciega' ? 0.85 : 0.9;
    assert.ok(limpias / items.length >= piso, `${nombre}: ${limpias}/${items.length} limpias, piso ${piso}`);
  });
}
