/**
 * cifras_contrato.test.mjs — Las pruebas del gate de cifras.
 *
 * Existen porque la primera version de `problemasDeSuperficies` se dio por buena tras once
 * comprobaciones hechas A MANO en una sesion: pasaron, no quedaron escritas, y una auditoria
 * externa encontro despues dos huecos que ninguna de ellas cubria. Una prueba que no vive en
 * el repositorio no protege nada.
 *
 * Cada caso dice si DEBE marcarse o NO. Los «no debe» valen tanto como los «debe»: un gate
 * que marca de mas se desactiva, y entonces no protege nada tampoco.
 *
 * Uso:  npm run cifras:test
 */

import { problemasDeSuperficies, jsonRevisable, sinRegionesNoLeidas } from './cifras_contrato.mjs';

const CASOS = [
  // --- HTML: lo que se ve --------------------------------------------------------------
  ['index.html', '<p>La plataforma publica 435 series productivas.</p>', true,
   'HTML · cifra retirada a la vista'],
  ['a.html', '<div>102 modelos de dengue</div>', true, 'HTML · 102 modelos'],
  ['b.html', '<p>111 x 3 = 435</p>', true, 'HTML · la ecuación falsa'],
  ['c.html', '<p>15 series nacionales</p>', true, 'HTML · los nacionales son 12'],
  ['d.html', '<p>145 series por sexo</p>', true, 'HTML · 145 por sexo (son 144)'],

  // --- HTML: lo que NO se ve, y por tanto no obliga ------------------------------------
  ['e.html', '<!-- su total 435 series contaba dos veces -->', false, 'HTML · comentario'],
  ['f.html', '<script>\n// el total 435 series era falso\n</script>', false, 'HTML · comentario JS'],
  ['g.html', '<a href="https://epiforecast.mx/x">432 series</a>', false,
   'HTML · el // de una URL no se traga la línea'],
  ['h.html', '<p>SMAPE 52 vs Prophet 102 en el backtest</p>', false,
   'HTML · «102» legítimo sin unidad: por eso se persigue la FORMA'],

  // --- JSON: el hueco que encontro la auditoria ----------------------------------------
  ['bento.json', '{"resumen":"El inventario son 435 series."}', true, 'JSON · cadena'],
  ['i.json', '{"motor":{"total":435}}', true,
   'JSON · NUMERO bajo clave de inventario — la forma real del bento.json viejo'],
  ['j.json', '{"rosters":{"total_series":435}}', true, 'JSON · número, clave explícita'],
  ['k.json', '{"gallery_items":435}', true, 'JSON · número, clave de galería'],
  ['l.json', '{"_nota":"se retiró porque su total 435 series mentía"}', false,
   'JSON · clave _*: nota de mantenimiento que nadie pinta'],
  ['m.json', '{"casos":[144,145,146]}', false,
   'JSON · dato de una serie temporal, no inventario'],
  ['n.json', '{"total":[145,145]}', false,
   'JSON · dentro de una lista un número es dato, aunque la clave suene a inventario'],
  ['o.json', '{"d":"M12 0C5.37 0 0 L435.2,99 3.435 9.795"}', false, 'JSON · geometría SVG'],
  ['p.json', '{"semana":31,"anio":2026}', false, 'JSON · números corrientes'],
];

let fallos = 0;
console.log('▶ Pruebas del contrato de cifras\n');
for (const [nombre, contenido, debe, desc] of CASOS) {
  const r = problemasDeSuperficies('/x', () => [nombre], () => contenido);
  const marco = r.problemas.length > 0;
  const ok = marco === debe;
  if (!ok) fallos++;
  console.log(`  ${ok ? '✔' : '✖ FALLO'}  ${debe ? 'marca   ' : 'no marca'}  ${desc}`);
  if (!ok && marco) console.log(`           inesperado → ${r.problemas[0]}`);
  if (!ok && !marco) console.log('           no lo detectó');
}

// --- El recorrido tiene que ser recursivo -----------------------------------------------
{
  const arbol = {
    '/x': [{ name: 'index.html', isDirectory: () => false },
           { name: 'Reports', isDirectory: () => true },
           { name: 'node_modules', isDirectory: () => true }],
    '/x/Reports': [{ name: 'hondo.html', isDirectory: () => false }],
    '/x/node_modules': [{ name: 'basura.html', isDirectory: () => false }],
  };
  const leidos = [];
  const r = problemasDeSuperficies('/x', (d) => arbol[d] ?? [], (f) => {
    leidos.push(f);
    return f.includes('hondo') ? '<p>435 series</p>' : '<p>432 series</p>';
  });
  const hondo = r.problemas.some((p) => p.includes('Reports/hondo.html'));
  const salto = !leidos.some((f) => f.includes('node_modules'));
  for (const [ok, desc] of [[hondo, 'recorre subdirectorios (Reports/hondo.html)'],
                            [salto, 'salta node_modules']]) {
    if (!ok) fallos++;
    console.log(`  ${ok ? '✔' : '✖ FALLO'}  recorrido  ${desc}`);
  }
}

// --- Las posiciones se conservan ---------------------------------------------------------
{
  const { texto } = sinRegionesNoLeidas('uno\n<!-- dos\ntres -->\ncuatro 435 series');
  const linea = texto.split('\n').findIndex((l) => l.includes('435 series')) + 1;
  const ok = linea === 4;
  if (!ok) fallos++;
  console.log(`  ${ok ? '✔' : '✖ FALLO'}  posición   el borrado conserva el número de línea (${linea}, esperado 4)`);
}

// --- Las exenciones se cuentan, no son silenciosas ---------------------------------------
{
  const { exentos } = jsonRevisable('{"_a":"x","_b":"y","c":"z"}');
  const ok = exentos === 2;
  if (!ok) fallos++;
  console.log(`  ${ok ? '✔' : '✖ FALLO'}  exenciones se cuentan y se informan (${exentos}, esperado 2)`);
}

console.log(fallos ? `\n✖ ${fallos} prueba(s) fallaron` : '\n✔ Todas las pruebas pasan');
process.exit(fallos ? 1 : 0);
