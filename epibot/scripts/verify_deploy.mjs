/**
 * Ejecuta todos los gates de contenido que preceden al deploy.
 *
 * `cifras:verify && rag:ci` bloqueaba correctamente, pero el primer fallo impedía ver el
 * segundo diagnóstico. Este runner no suaviza el veredicto: ejecuta ambos, conserva sus
 * códigos y termina en rojo si cualquiera falla.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const DEPLOY_CHECKS = Object.freeze(['cifras:verify', 'rag:ci']);

export function runDeployChecks(run = spawnSync, checks = DEPLOY_CHECKS) {
  const results = [];
  for (const name of checks) {
    const result = run('npm', ['run', name], { stdio: 'inherit', env: process.env });
    const status = Number.isInteger(result?.status) ? result.status : 1;
    results.push({ name, status });
  }
  return results;
}

export function exitCode(results) {
  return results.every(result => result.status === 0) ? 0 : 1;
}

function isMain() {
  return Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
}

if (isMain()) {
  const results = runDeployChecks();
  console.log('\nResumen de gates de deploy:');
  for (const { name, status } of results) {
    console.log(`  ${status === 0 ? 'PASS' : 'FAIL'}  ${name} (rc=${status})`);
  }
  process.exitCode = exitCode(results);
}
