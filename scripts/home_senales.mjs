#!/usr/bin/env node
/**
 * home_senales.mjs — portada: proporción de lo publicado y «lo que cambia» en el boletín vigente (25-nov-2026).
 *
 * Decisión del autor tras la mesa de la plataforma (planes/mesa_plataforma_2026-11-25/ACTA.md): junto al contador, cuántos
 * padecimientos tienen modelo y cuántos son controles estacionales; y en la franja del radar, las cinco alzas y las cinco
 * bajas del boletín con su estado (pronóstico publicado, control estacional o sin modelo validado), con enlace a su ficha.
 *
 * Es HTML estático entre marcadores (se lee sin JavaScript ni red), con las mismas cifras que el radar: `senales()` de
 * assets/boletin/senales.mjs sobre la foto de assets/boletin/actual.json, y el estado de cada release con la regla común de
 * assets/site/estado-ficha.js. Ninguna cifra nueva. Las categorías de temas sensibles llevan la línea de ayuda.
 *
 * Uso: node scripts/home_senales.mjs [--root DIR] [--check]
 * boletin_semana_activa.py lo corre al activar cada foto; `npm run test:boletin` corre --check.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const args = process.argv.slice(2);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
// El código (módulos del radar, catálogo y regla de estado) sale de este repositorio; los datos, de --root.
const CODIGO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ = resolve(opt('--root') ?? CODIGO);
const CHECK = args.includes('--check');
const leer = (rel) => readFileSync(resolve(RAIZ, rel), 'utf8');
const json = (rel) => JSON.parse(leer(rel));

const { senales, textoCambio } = await import(resolve(CODIGO, 'assets/boletin/senales.mjs'));
const { numero } = await import(resolve(CODIGO, 'assets/boletin/celdas.mjs'));
const { platformPage } = await import(resolve(CODIGO, 'assets/boletin/coverage.mjs'));
const { nombreVisible } = await import(resolve(CODIGO, 'assets/boletin/nombres.mjs'));
await import(resolve(CODIGO, 'epibot/js/release_catalog.js'));
const RELEASES = globalThis.EPI_CATALOGO.releases;
const ctx = vm.createContext({});
vm.runInContext(readFileSync(resolve(CODIGO, 'assets/site/estado-ficha.js'), 'utf8'), ctx);
const E = ctx.EpiEstadoFicha;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NF = new Intl.NumberFormat('es-MX');
const PALABRAS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco'];

/** Proporción de lo publicado: originales, con modelo propio y controles estacionales, desde cada vista. */
export function proporcion(raiz = RAIZ) {
  const L = (rel) => JSON.parse(readFileSync(resolve(raiz, rel), 'utf8'));
  let modelo = 0, control = 0;
  for (const r of RELEASES) {
    const t = E.tipo(L(`publication/${r.id}/vista.json`));
    if (t === 'control') control++;
    else if (t === 'pass' || t === 'pending') modelo++;
    else throw new Error(`${r.id}: estado sin clasificar (${t})`);
  }
  const total = L(`${L('assets/boletin/actual.json').carpeta}/data.json`).meta.platform_published;
  const originales = total - RELEASES.length;
  if (originales !== 4) throw new Error(`se esperaban 4 originales y salen ${originales}`);
  return { total, originales, modelo, control };
}

function estadoDe(d) {
  const sens = !!RELEASES.find((r) => r.id === d.platform_id)?.sensible;
  if (d.status === 'Publicada') return { kind: 'pronostico', texto: 'Con pronóstico publicado', href: platformPage(d.platform_id), sens };
  if (d.status === 'Control publicado') return { kind: 'control', texto: 'Control estacional, no validado', href: platformPage(d.platform_id), sens };
  if (d.status === 'No modelable') return { kind: 'sin-modelo', texto: 'Sin modelo validado', href: `no_modelables.html#cat-${d.id}`, sens };
  if (d.status === 'Rechazada') return { kind: 'sin-modelo', texto: 'Analizada y rechazada', href: 'rechazados.html', sens };
  return { kind: 'sin-modelo', texto: 'Sin pronóstico', href: 'boletin.html', sens };
}

export function bloques(raiz = RAIZ) {
  const L = (rel) => JSON.parse(readFileSync(resolve(raiz, rel), 'utf8'));
  const actual = L('assets/boletin/actual.json');
  const data = L(`${actual.carpeta}/data.json`);
  const { year, week } = data.meta;
  const anioDe = (d) => (d && d.observed_week > week ? year - 1 : year);
  const num = (v, d) => numero(v, d?.guion, anioDe(d));
  const s = senales(data.diseases, num);
  let sensibles = 0;
  const fila = (x) => {
    const e = estadoDe(x.d);
    if (e.sens) sensibles++;
    return `      <li><a class="home-senales__nombre" href="${esc(e.href)}">${esc(nombreVisible(x.d.id, x.d.name))}</a>`
      + `<span class="home-senales__cambio home-senales__cambio--${x.pct > 0 ? 'sube' : 'baja'}">${esc(textoCambio(x.pct))}</span>`
      + `<span class="home-senales__cifras">${esc(x.d.code)} · ${NF.format(num(x.d.cumulative, x.d))} frente a ${NF.format(num(x.d.previous, x.d))}</span>`
      + `<span class="home-senales__estado home-senales__estado--${e.kind}">${esc(e.texto)}</span></li>`;
  };
  const lista = (titulo, xs) => `    <div class="home-senales__col">\n      <h3>${titulo}</h3>\n      <ol>\n${xs.map(fila).join('\n')}\n      </ol>\n    </div>`;
  const cols = [lista('Aumentan', s.suben), lista('Disminuyen', s.bajan)].join('\n');
  const ayuda = sensibles
    ? `\n    <p class="home-senales__ayuda"><strong>Si tú o alguien cercano necesita apoyo:</strong> la <strong>Línea de la Vida</strong> atiende gratis, las 24 horas, en el <a href="tel:8009112000">800 911 2000</a>. Si alguien está en peligro inmediato, llama al <a href="tel:911">911</a>.</p>`
    : '';
  const radar = `<!-- home:radar:start -->
<section class="home-radar" aria-label="Radar del boletín">
  <div class="wrap">
    <a class="radar-row" href="boletin.html" id="acceso-radar-boletin">
      <span class="radar-row__kicker">Datos observados</span>
      <b>Radar del boletín</b>
      <span class="radar-row__text">Notificaciones oficiales por semana, año y entidad.</span>
      <span class="radar-row__go" aria-hidden="true">↗</span>
    </a>
    <div class="home-senales" aria-labelledby="senalesTitulo">
    <h2 class="home-senales__titulo" id="senalesTitulo">Lo que cambia en el boletín ${week} de ${year}</h2>
    <p class="home-senales__nota">Notificaciones acumuladas de ${year} frente al mismo periodo de ${year - 1}, en las categorías con al menos 1,000 el año anterior. Son casos notificados, no tasas. Cada fila dice si tiene pronóstico publicado, si es un control estacional o si no tiene modelo validado. <a href="boletin.html#senales">Ver en el radar</a>.</p>
    <div class="home-senales__cols">
${cols}
    </div>${ayuda}
    </div>
  </div>
</section>
<!-- home:radar:end -->`;
  const p = proporcion(raiz);
  const palabra = (n) => PALABRAS[n] ?? NF.format(n);
  const mezcla = `<!-- home:mezcla:start -->
      <p class="home-hero__mezcla" id="mezclaPadecimientos">De los ${NF.format(p.total)}: ${palabra(p.originales)} originales, ${NF.format(p.modelo)} con un modelo que superó su prueba de 2025 y <strong>${NF.format(p.control)} controles estacionales, no validados</strong>, que repiten los casos de 52 semanas antes.</p>
      <!-- home:mezcla:end -->`;
  return { radar, mezcla, senales: s, proporcion: p };
}

function reemplaza(html, marca, bloque) {
  const re = new RegExp(`<!-- home:${marca}:start -->[\\s\\S]*?<!-- home:${marca}:end -->`);
  if (!re.test(html)) throw new Error(`index.html sin los marcadores home:${marca}`);
  return html.replace(re, bloque.trim().replace(/^\s+/, ''));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ruta = resolve(RAIZ, 'index.html');
  // Una raíz sin portada (las raíces sintéticas de las pruebas del activador) no tiene nada que actualizar.
  if (!existsSync(ruta)) { console.log('[home_senales] sin index.html en la raíz: nada que actualizar'); process.exit(0); }
  const html = readFileSync(ruta, 'utf8');
  const b = bloques();
  const nuevo = reemplaza(reemplaza(html, 'radar', b.radar), 'mezcla', b.mezcla);
  if (CHECK) {
    if (nuevo !== html) { console.error('[home_senales] index.html desactualizado: ejecute node scripts/home_senales.mjs'); process.exit(1); }
    console.log('[home_senales] portada al día');
  } else if (nuevo !== html) {
    writeFileSync(ruta, nuevo);
    console.log(`[home_senales] portada actualizada: ${b.senales.suben.length} alzas, ${b.senales.bajan.length} bajas; ${b.proporcion.modelo} con modelo y ${b.proporcion.control} controles`);
  } else console.log('[home_senales] portada al día');
}
