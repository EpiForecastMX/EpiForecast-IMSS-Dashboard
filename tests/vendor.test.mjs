/**
 * Bibliotecas servidas desde el sitio y CSP del EpiBot (decisión del autor, 25-nov-2026; acta en
 * planes/mesa_plataforma_2026-11-25/). Copias de los paquetes de npm (npm pack verifica su integridad), con su licencia.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel) => readFileSync(resolve(root, rel), 'utf8');
const VENDOR = {
  'assets/vendor/chart.js-4.4.7/chart.umd.js': '2812cb8825fdc57469eb2f7bb055e9429244e599920511ee477e828499b632cb',
  'assets/vendor/marked-18.3.0/marked.umd.js': 'f8c7f128939415995e2219e8a84bec42fab27f5980d22e361339e6901da5eadf',
  'assets/vendor/dompurify-3.2.4/purify.min.js': '8eb41b658831fab175fad9bcd00fcb2d84e0ed3a25a55053d4ecd4444b8b43a0',
};

test('cada biblioteca es la copia fijada (sha256) y lleva su licencia', () => {
  for (const [rel, sha] of Object.entries(VENDOR)) {
    assert.equal(createHash('sha256').update(readFileSync(resolve(root, rel))).digest('hex'), sha, rel);
    const dir = dirname(rel);
    assert.ok(['LICENSE', 'LICENSE.md'].some((f) => existsSync(resolve(root, dir, f))), `${dir}: falta la licencia`);
  }
  assert.match(leer('netlify.toml'), /for = "\/assets\/vendor\/\*"[\s\S]*?immutable/);
});

test('ninguna página carga Chart.js 4.4.7, marked ni DOMPurify desde un CDN; la ruta local existe', () => {
  const html = execFileSync('git', ['ls-files', '*.html'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  for (const f of html) {
    const t = leer(f);
    assert.doesNotMatch(t, /cdn\.jsdelivr\.net\/npm\/(chart\.js@4\.4\.7|marked\/|dompurify@)/, f);
    for (const m of t.matchAll(/src="((?:\.\.\/)*assets\/vendor\/[^"]+)"/g)) {
      assert.ok(existsSync(resolve(root, dirname(f), m[1])), `${f}: ${m[1]} no existe`);
    }
  }
});

test('EpiBot: CSP sin scripts de terceros ni en línea, y sin manejadores en línea en el reporte', () => {
  const t = leer('epibot/index.html');
  const csp = t.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/)?.[1];
  assert.ok(csp, 'falta la CSP');
  assert.match(csp, /script-src 'self';/);
  assert.match(csp, /connect-src 'self';/);
  assert.match(csp, /object-src 'none'/);
  assert.doesNotMatch(csp, /script-src[^;]*(unsafe-inline|unsafe-eval|https?:)/);
  assert.equal((t.match(/<script>/g) || []).length, 0, 'sin scripts en línea');
  assert.doesNotMatch(t, /\son(click|load|error|change)=/);
  const app = leer('epibot/js/app.js');
  assert.doesNotMatch(app, /onclick="window\.print\(\)"/);
  assert.doesNotMatch(app, /fonts\.googleapis\.com/);
  assert.match(t, /<script defer src="js\/chart_defaults\.js\?v=\d+"><\/script>/);
});
