/**
 * run_tests.js — Ejecuta 380+ tests contra kb.js + entities.js.
 *
 * Mockea fetch() para que loadKnowledge() funcione en Node.js,
 * luego llama answer() por cada test y valida:
 *   - expectedHandler: '*' = any handler OK, null = must return null, string = specific
 *   - mustContain / mustNotContain (case-insensitive)
 *   - checkEntities (deteccion de entidades)
 *
 * Uso: node tests/run_tests.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

const { norm, detectEntities } = await import('../js/entities.js');
const { answer, loadKnowledge, _resetContext } = await import('../js/kb.js');

// Pre-load knowledge
await loadKnowledge();

// ─────────────────────────────────────────────────────────────────────────────
// Load test cases
// ─────────────────────────────────────────────────────────────────────────────

let testCases;
try {
  testCases = JSON.parse(readFileSync(join(__dirname, 'test_cases.json'), 'utf-8'));
} catch {
  console.error('ERROR: test_cases.json not found. Run generate_tests.js first.');
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test runner
// ─────────────────────────────────────────────────────────────────────────────

let totalPass = 0;
let totalFail = 0;
const failures = [];

console.log(`\nRunning ${testCases.length} tests...\n`);

for (const t of testCases) {
  const { id, query, expectedHandler, mustContain, mustNotContain, checkEntities } = t;
  const issues = [];

  // Reset conversational context between tests to avoid contamination
  _resetContext();

  // 0. Run setup query to establish context (for follow-up tests)
  if (t.setupQuery) {
    try { await answer(t.setupQuery); } catch {}
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

  // 2. Answer validation
  let result;
  try {
    result = await answer(query);
  } catch (err) {
    issues.push(`CRASH: ${err.message}`);
  }

  // 3. Check expectedHandler
  if (expectedHandler === null) {
    // Must return null (Gemini fallback / off-topic)
    if (result !== null) {
      issues.push(`HANDLER: expected null (Gemini fallback), got a response`);
    }
  } else if (expectedHandler === '*') {
    // Any response is fine (entity-only test) — no handler check
  }
  // For named handlers: we can't check which handler fired, but we validate via mustContain

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

// Summary by handler
const handlerStats = {};
for (const t of testCases) {
  const h = t.expectedHandler || 'null';
  if (h === '*') continue; // entity-only tests not counted per-handler
  if (!handlerStats[h]) handlerStats[h] = { pass: 0, fail: 0 };
}
for (const t of testCases) {
  const h = t.expectedHandler || 'null';
  if (h === '*') continue;
  const failed = failures.some(f => f.id === t.id);
  if (failed) handlerStats[h].fail++;
  else handlerStats[h].pass++;
}

console.log('RESULTS BY HANDLER:');
console.log('-'.repeat(55));
for (const [handler, stats] of Object.entries(handlerStats).sort((a, b) => a[0].localeCompare(b[0]))) {
  const total = stats.pass + stats.fail;
  const pct = ((stats.pass / total) * 100).toFixed(0);
  const icon = stats.fail === 0 ? 'OK' : `FAIL(${stats.fail})`;
  console.log(`  ${handler.padEnd(32)} ${String(stats.pass).padStart(3)}/${total}  (${pct.padStart(3)}%)  ${icon}`);
}

console.log('\n' + '='.repeat(70));
process.exit(totalFail > 0 ? 1 : 0);
