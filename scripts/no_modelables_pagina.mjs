#!/usr/bin/env node
// Escribe en no_modelables.html, entre sus marcadores, las tablas de las categorías no modelables de la foto vigente
// del radar (assets/boletin/actual.json → data.json): cifras impresas del boletín y motivo medido de cada una.
// Determinista: sin reloj ni red. boletin_semana_activa.py lo corre al activar cada foto semanal.
//
// Uso: node scripts/no_modelables_pagina.mjs [--root DIR] [--check]
//   --check no escribe; rc=1 si la página difiere de lo generado.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GUION, guionNoPublicado, muestra } from '../assets/boletin/celdas.mjs';
import { GRUPOS_NO_MODELABLES, filasNoModelables, nombreLimpio } from '../assets/boletin/no_modelables.mjs';
import { numeroEnPalabras } from '../assets/boletin/textos.mjs';

export const PAGINA = 'no_modelables.html';
const INICIO = '<!-- no-modelables:start · generado por scripts/no_modelables_pagina.mjs; no editar a mano -->';
const FIN = '<!-- no-modelables:end -->';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function celda(v, e, anio) {
  if (v === GUION) {
    return guionNoPublicado(e.guion, anio)
      ? '<span class="marcador no-publicado" title="Cifra no publicada en este cuadro, no cero">–</span>'
      : '<span class="marcador" title="Guion impreso: no se presentaron casos">–</span>';
  }
  if (typeof v === 'string' || v == null) return `<span class="marcador">${esc(muestra(v))}</span>`;
  return esc(muestra(v));
}

/** Bloque HTML generado para la foto (data, actual). */
export function bloqueNoModelables(data, actual) {
  const m = data.meta;
  const filas = filasNoModelables(data.diseases);
  const pdf = `${actual.carpeta}/${actual.pdf}`;
  const porGrupo = Object.entries(GRUPOS_NO_MODELABLES).sort((a, b) => a[1].orden - b[1].orden)
    .map(([g, info]) => [g, info, filas.filter((e) => e.no_modelable.grupo === g)]).filter(([, , fs]) => fs.length);
  const total = filas.length;
  const out = [INICIO];
  out.push('<div class="stats" aria-label="Conteos">' +
    `<div class="stat"><div class="v">${m.platform_published}</div><div class="l">Padecimientos con pronóstico publicado</div></div>` +
    `<div class="stat"><div class="v">${total}</div><div class="l">Categorías sin pronóstico</div></div>` +
    `<div class="stat"><div class="v">${porGrupo.length}</div><div class="l">Motivos medidos</div></div></div>`);
  out.push(`<p class="nm-resumen" id="nmResumen"><strong>${esc(numeroEnPalabras(total, { mayuscula: true }))} categorías</strong> ` +
    `del Boletín Epidemiológico ${m.week} de ${m.year} no tienen pronóstico en EpiForecast-MX: ` +
    porGrupo.map(([, info, fs]) => `${numeroEnPalabras(fs.length)} ${esc(info.resumen)}`)
      .join(', ').replace(/, ([^,]*)$/, ' y $1') + '.</p>');
  out.push('<nav class="nm-indice" aria-label="Grupos de motivo"><ul>' + porGrupo.map(([g, info, fs]) =>
    `<li><a href="#grupo-${g}">${esc(info.etiqueta)}</a> <span>${fs.length}</span></li>`).join('') + '</ul></nav>');
  for (const [g, info, fs] of porGrupo) {
    out.push(`<section class="nm-grupo" id="grupo-${g}" aria-labelledby="titulo-${g}">`);
    out.push(`<h2 id="titulo-${g}">${esc(info.etiqueta)} <span class="nm-cuenta">${fs.length}</span></h2>`);
    out.push(`<p>${esc(info.explicacion)}</p>`);
    out.push('<div class="table-scroll"><table class="nm-tabla">');
    out.push(`<caption>${esc(info.etiqueta)}: cifras impresas del boletín ${m.week} de ${m.year} y motivo medido</caption>`);
    out.push('<thead><tr><th scope="col">Categoría</th><th scope="col">CIE impreso</th><th scope="col">Semana del cuadro</th>' +
      `<th scope="col">Casos de la semana</th><th scope="col">Acumulado ${m.year}</th>` +
      `<th scope="col">Acumulado comparable ${m.year - 1}</th><th scope="col">Motivo medido</th></tr></thead><tbody>`);
    for (const e of fs) {
      const anio = e.observed_week > m.week ? m.year - 1 : m.year;
      out.push(`<tr id="cat-${esc(e.id)}"><th scope="row">${esc(nombreLimpio(e.name))}` +
        `<span class="nm-sub">${esc(e.group)} · <a href="/${esc(pdf)}#page=${e.page}" target="_blank" rel="noopener">PDF, p. ${e.page}</a></span></th>` +
        `<td class="nm-cie">${esc(e.code)}</td><td class="num">${e.observed_week}</td>` +
        `<td class="num">${celda(e.weekly, e, anio)}</td><td class="num">${celda(e.cumulative, e, anio)}</td>` +
        `<td class="num">${celda(e.previous, e, anio)}</td><td class="nm-motivo">${esc(e.reason)}</td></tr>`);
    }
    out.push('</tbody></table></div>');
    out.push('</section>');
  }
  const simb = m.symbols?.simbolos?.[GUION] ?? 'no se presentaron casos';
  out.push(`<p class="table-note" id="nmNota">«–» es el guion que imprime el boletín; su simbología lo define como «${esc(simb)}». ` +
    'En sarampión y paludismo por P. falciparum es una cifra que el cuadro no publica, no un cero (sus notas registran casos). ' +
    `Fuente: Boletín Epidemiológico ${m.week} de ${m.year} del SINAVE, fecha de referencia / primera disponibilidad comprobada: ${esc(m.publication)}. ` +
    'Las cifras se actualizan con cada boletín junto con el radar.</p>');
  out.push(FIN);
  return out.join('\n');
}

export function generar(root) {
  const leer = (r) => JSON.parse(readFileSync(resolve(root, r), 'utf8'));
  const actual = leer('assets/boletin/actual.json');
  const data = leer(`${actual.carpeta}/data.json`);
  const ruta = resolve(root, PAGINA);
  const html = readFileSync(ruta, 'utf8');
  const i = html.indexOf(INICIO), j = html.indexOf(FIN);
  if (i < 0 || j < i || html.indexOf(INICIO, i + 1) >= 0 || html.indexOf(FIN, j + 1) >= 0) {
    throw new Error(`${PAGINA}: marcadores ausentes o repetidos`);
  }
  return { ruta, previo: html, nuevo: html.slice(0, i) + bloqueNoModelables(data, actual) + html.slice(j + FIN.length) };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const root = args.includes('--root') ? resolve(args[args.indexOf('--root') + 1]) : resolve(new URL('..', import.meta.url).pathname);
  const { ruta, previo, nuevo } = generar(root);
  if (args.includes('--check')) {
    if (previo !== nuevo) { console.error(`${PAGINA} no coincide con la foto vigente: node scripts/no_modelables_pagina.mjs`); process.exit(1); }
    console.log(`${PAGINA} al día con la foto vigente`);
  } else {
    if (previo !== nuevo) writeFileSync(ruta, nuevo);
    console.log(`${PAGINA} ${previo === nuevo ? 'sin cambios' : 'actualizada'}`);
  }
}
