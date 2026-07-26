/**
 * run_tests.js — Ejecuta la suite de casos contra kb.js + entities.js.
 *
 * Mockea fetch() para que loadKnowledge() funcione en Node.js, y llama answerWithTrace() por cada
 * caso para validar:
 *   - expectedHandler: nombre concreto = IGUALDAD EXACTA con el handler que realmente respondio;
 *     '*' = no se exige nombre (el resto de aserciones sigue); null = respuesta Y handler nulos
 *   - la invariante de traza: respuesta no nula <-> handler con nombre (nunca una sin la otra)
 *   - mustContain / mustNotContain (case-insensitive)
 *   - checkEntities (deteccion de entidades)
 *
 * Hasta 47.2-B3 el nombre del handler NO se verificaba: se daba por bueno si el texto contenia lo
 * esperado, asi que 65 casos corrian por un handler distinto del declarado y la suite seguia verde.
 *
 * Uso: node tests/run_tests.js [ruta/a/otro_fixture.json]
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─────────────────────────────────────────────────────────────────────────────
// Mock globalThis.fetch para que kb.js pueda cargar knowledge.json
// ─────────────────────────────────────────────────────────────────────────────

const knowledgePath = join(__dirname, '..', 'knowledge.json');
const knowledgeRaw = readFileSync(knowledgePath, 'utf-8');

globalThis.fetch = async () => ({
  ok: true,
  json: async () => JSON.parse(knowledgeRaw),
});

// ─────────────────────────────────────────────────────────────────────────────
// Import KB modules (after fetch mock is in place)
// ─────────────────────────────────────────────────────────────────────────────

// RNG fijo SOLO en el harness: answerGraficoAleatorio elige al azar y sin esto la suite no es
// reproducible. La aleatoriedad productiva no se toca (esto vive en el runner, no en kb.js).
Math.random = () => 0.42;

const { norm, detectEntities } = await import('../js/entities.js');
const { answerWithTrace, loadKnowledge, _resetContext } = await import('../js/kb.js');

// Pre-load knowledge
await loadKnowledge();

// ─────────────────────────────────────────────────────────────────────────────
// Load test cases
// ─────────────────────────────────────────────────────────────────────────────

// El fixture es parametrizable para poder ejercitar el propio runner contra uno alterado (la
// regresion negativa de 47.2-B3). Sin argumento, el oficial.
const fixturePath = process.argv[2] ? resolve(process.argv[2]) : join(__dirname, 'test_cases.json');

let testCases;
try {
  testCases = JSON.parse(readFileSync(fixturePath, 'utf-8'));
} catch {
  console.error(`ERROR: no pude leer ${fixturePath}. Ejecuta generate_tests.js primero.`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test runner
// ─────────────────────────────────────────────────────────────────────────────

let totalPass = 0;
let totalFail = 0;
const failures = [];
const observados = new Map();   // id -> handler REAL (el resumen se construye con esto)

console.log(`\nRunning ${testCases.length} tests...\n`);

for (const t of testCases) {
  const { id, query, expectedHandler, mustContain, mustNotContain, checkEntities } = t;
  const issues = [];

  // Reset conversational context between tests to avoid contamination
  _resetContext();

  // 0. Run setup query to establish context (for follow-up tests)
  if (t.setupQuery) {
    try { await answerWithTrace(t.setupQuery); } catch {}
  }

  // 1. Entity detection validation
  if (checkEntities && Object.keys(checkEntities).length > 0) {
    const ent = detectEntities(query);
    for (const [key, expected] of Object.entries(checkEntities)) {
      if (expected === undefined || expected === null) continue;
      const actual = ent[key];

      if (Array.isArray(expected)) {
        if (!Array.isArray(actual) || JSON.stringify(actual) !== JSON.stringify(expected)) {
          issues.push(`ENTITY ${key}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
      } else if (actual !== expected) {
        issues.push(`ENTITY ${key}: expected "${expected}", got "${actual}"`);
      }
    }
  }

  // 2. Answer validation — por la MISMA ruta que la produccion, con la identidad del handler
  let result = null;
  let handler = null;
  try {
    ({ response: result, handler } = await answerWithTrace(query));
  } catch (err) {
    issues.push(`CRASH: ${err.message}`);
  }
  observados.set(id, handler);

  // 3. Check expectedHandler — igualdad EXACTA con el handler real
  if (expectedHandler === null) {
    if (result !== null) issues.push(`HANDLER: expected null (cesion a RAG/Gemini), got a response`);
    if (handler !== null) issues.push(`HANDLER: expected null, traced "${handler}"`);
  } else if (expectedHandler === '*') {
    // Comodin: no se exige nombre. El resto de aserciones sigue aplicando.
  } else if (handler !== expectedHandler) {
    issues.push(`HANDLER: expected "${expectedHandler}", got "${handler}"`);
  }

  // 3b. Invariante de traza: o hay respuesta Y dueño, o no hay ninguno de los dos.
  if ((result !== null) !== (handler !== null)) {
    issues.push(`TRACE: respuesta ${result !== null ? 'no nula' : 'nula'} con handler ${handler === null ? 'nulo' : `"${handler}"`}`);
  }

  // 4. mustContain validation (case-insensitive)
  if (result !== null && mustContain.length > 0) {
    const resultLower = result.toLowerCase();
    for (const mc of mustContain) {
      if (!resultLower.includes(mc.toLowerCase())) {
        issues.push(`MUST_CONTAIN: "${mc}" not found in response`);
      }
    }
  } else if (result === null && mustContain.length > 0) {
    issues.push(`NULL_RESPONSE: expected response with [${mustContain.join(', ')}], got null`);
  }

  // 5. mustNotContain validation (case-insensitive)
  if (result !== null && mustNotContain.length > 0) {
    const resultLower = result.toLowerCase();
    for (const mnc of mustNotContain) {
      if (typeof mnc !== 'string') continue;
      if (resultLower.includes(mnc.toLowerCase())) {
        issues.push(`MUST_NOT_CONTAIN: "${mnc}" found in response`);
      }
    }
  }

  if (issues.length === 0) {
    totalPass++;
  } else {
    totalFail++;
    failures.push({
      id,
      query,
      expectedHandler,
      issues,
      responsePreview: result ? result.substring(0, 150) + (result.length > 150 ? '...' : '') : '(null)',
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Results
// ─────────────────────────────────────────────────────────────────────────────

console.log('='.repeat(70));
console.log('TEST RESULTS');
console.log('='.repeat(70));
console.log(`PASS: ${totalPass} | FAIL: ${totalFail} | TOTAL: ${testCases.length}`);
console.log(`Pass rate: ${((totalPass / testCases.length) * 100).toFixed(1)}%`);
console.log('');

if (failures.length) {
  console.log(`FAILURES (${failures.length}):\n`);
  for (const f of failures) {
    console.log(`  #${f.id} [${f.expectedHandler || 'null'}] "${f.query}"`);
    for (const i of f.issues) {
      console.log(`    -> ${i}`);
    }
    console.log(`    Response: ${f.responsePreview}`);
    console.log('');
  }
}

// Resumen por handler OBSERVADO: el reparto real de la cadena, no el que declara el fixture.
// Construirlo con la expectativa era describir lo que se creia, no lo que pasa.
const handlerStats = {};
const fallidos = new Set(failures.map(f => f.id));
for (const t of testCases) {
  const h = observados.get(t.id) || 'null';
  if (!handlerStats[h]) handlerStats[h] = { pass: 0, fail: 0 };
  if (fallidos.has(t.id)) handlerStats[h].fail++;
  else handlerStats[h].pass++;
}

console.log('RESULTS BY HANDLER (observado):');
console.log('-'.repeat(55));
for (const [handler, stats] of Object.entries(handlerStats).sort((a, b) => a[0].localeCompare(b[0]))) {
  const total = stats.pass + stats.fail;
  const pct = ((stats.pass / total) * 100).toFixed(0);
  const icon = stats.fail === 0 ? 'OK' : `FAIL(${stats.fail})`;
  console.log(`  ${handler.padEnd(32)} ${String(stats.pass).padStart(3)}/${total}  (${pct.padStart(3)}%)  ${icon}`);
}

console.log('\n' + '='.repeat(70));
process.exit(totalFail > 0 ? 1 : 0);
