/**
 * eval/pareada.mjs — comparación pareada del EpiBot (plan canónico 3.1, 26-nov-2026).
 *
 * Antes de reducir duplicación en kb.js se fija el comportamiento: cada pregunta de las baterías curadas
 * (tests/fixtures/estres) y de los casos funcionales (tests/test_cases.json) se responde turno por turno y se guarda la
 * respuesta completa (texto, marcadores de gráfica y botones), el manejador y el estado conversacional. Los casos funcionales
 * se corren además como una sola conversación larga, sin reiniciar, para cubrir la herencia de contexto entre rutas.
 *
 * Uso: node eval/pareada.mjs graba salida.json   ·   node eval/pareada.mjs compara referencia.json
 * Sin red: lee las vistas del repositorio. Termina con código 1 si `compara` encuentra alguna diferencia.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';

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
await kb.getData().obesidad_pendiente;

const dir = new URL('../tests/fixtures/estres/', import.meta.url);
const conversaciones = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  for (const it of JSON.parse(readFileSync(new URL(f, dir), 'utf8'))) if (it.turnos?.length) conversaciones.push({ id: `${f}:${it.turnos.join(' → ')}`, turnos: it.turnos });
}
const casos = JSON.parse(readFileSync(new URL('../tests/test_cases.json', import.meta.url), 'utf8')).map((c) => c.query).filter(Boolean);
for (const q of casos) conversaciones.push({ id: `test_cases:${q}`, turnos: [q] });
conversaciones.push({ id: 'test_cases:cadena', turnos: casos });

async function corre(c) {
  kb._resetContext();
  const out = [];
  for (const t of c.turnos) {
    const r = await kb.answerWithTrace(t);
    out.push({ q: t, handler: r.handler ?? null, response: r.response ?? null, contexto: kb._contexto() });
  }
  kb._resetContext();
  return out;
}

const [modo, archivo] = process.argv.slice(2);
const resultado = {};
for (const c of conversaciones) resultado[c.id] = await corre(c);
const turnos = Object.values(resultado).reduce((a, x) => a + x.length, 0);
if (modo === 'graba') {
  writeFileSync(archivo, JSON.stringify(resultado));
  console.log(`grabadas ${conversaciones.length} conversaciones, ${turnos} turnos`);
} else if (modo === 'compara') {
  const ref = JSON.parse(readFileSync(archivo, 'utf8'));
  const difs = [];
  for (const [id, xs] of Object.entries(resultado)) {
    const ys = ref[id];
    if (!ys) { difs.push(`${id}: no está en la referencia`); continue; }
    xs.forEach((x, i) => {
      for (const k of ['handler', 'response', 'contexto']) {
        if (JSON.stringify(x[k]) !== JSON.stringify(ys[i]?.[k])) difs.push(`${id} [turno ${i + 1}: ${x.q}] ${k}`);
      }
    });
  }
  for (const id of Object.keys(ref)) if (!resultado[id]) difs.push(`${id}: falta en esta corrida`);
  console.log(`${conversaciones.length} conversaciones, ${turnos} turnos, ${difs.length} diferencias`);
  for (const d of difs.slice(0, 40)) console.log(`✖ ${d}`);
  process.exitCode = difs.length ? 1 : 0;
} else {
  console.error('uso: node eval/pareada.mjs graba|compara archivo.json');
  process.exitCode = 2;
}
