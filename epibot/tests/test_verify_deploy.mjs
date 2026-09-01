import test from 'node:test';
import assert from 'node:assert/strict';

import { DEPLOY_CHECKS, exitCode, runDeployChecks } from '../scripts/verify_deploy.mjs';

test('ejecuta los dos gates aunque el primero falle', () => {
  const calls = [];
  const statuses = [7, 0];
  const results = runDeployChecks((command, args, options) => {
    calls.push({ command, args, stdio: options.stdio });
    return { status: statuses[calls.length - 1] };
  });

  assert.deepEqual(calls.map(call => call.args.at(-1)), DEPLOY_CHECKS);
  assert.deepEqual(results, [
    { name: 'cifras:verify', status: 7 },
    { name: 'rag:ci', status: 0 },
  ]);
  assert.equal(exitCode(results), 1);
});

test('si el segundo falla también termina en rojo', () => {
  const results = runDeployChecks(
    (_command, args) => ({ status: args.at(-1) === 'rag:ci' ? 9 : 0 }),
  );
  assert.deepEqual(results.map(result => result.status), [0, 9]);
  assert.equal(exitCode(results), 1);
});

test('sólo dos PASS producen rc cero', () => {
  assert.equal(exitCode(runDeployChecks(() => ({ status: 0 }))), 0);
  assert.equal(exitCode([{ name: 'cifras:verify', status: null }]), 1);
});
