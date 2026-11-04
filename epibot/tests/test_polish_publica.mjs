import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// polishSpanish real de app.js, sin DOM. APP_BASE permite comprobar que falla en el árbol previo.
const app = readFileSync(process.env.APP_BASE || new URL('../js/app.js', import.meta.url), 'utf8');
const between = (a, b) => app.slice(app.indexOf(a), app.indexOf(b, app.indexOf(a)));
const polish = vm.runInNewContext(`${between('const SPANISH_FIXES =', '// Paleta mejorada')}\npolishSpanish`, {});

test('«publica» como verbo conserva su ortografía', () => {
  for (const s of ['Lo que sí se publica es qué motor quedó productivo.',
    'La galería publica **444 gráficos**.', 'Esto no se publica.', 'El sitio ya publica la semana.']) {
    assert.equal(polish(s), s, s);
  }
});

test('«pública» y sus formas como adjetivo reciben tilde', () => {
  assert.equal(polish('para la salud publica en Mexico'), 'para la salud pública en México');
  assert.equal(polish('datos publicos y fuentes publicas'), 'datos públicos y fuentes públicas');
  assert.equal(polish('el sector publico'), 'el sector público');
  assert.equal(polish('Publicas'), 'Públicas');
});
