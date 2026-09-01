import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const landing = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

test('la portada no descarga el snapshot bento histórico', () => {
  assert.doesNotMatch(landing, /fetch\(['"]bento\.json['"]/);
  assert.doesNotMatch(landing, /id=['"]b-week['"]/);
});
