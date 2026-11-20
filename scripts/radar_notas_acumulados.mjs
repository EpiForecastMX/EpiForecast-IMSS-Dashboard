#!/usr/bin/env node
// Acumulados NACIONALES que imprimen las notas del boletín para categorías cuyo cuadro estatal no publica la cifra
// (orden del autor, alta_b44, 20-nov-2026: pronóstico para todas). Sarampión: «A la SE N, se registran X casos
// confirmados de sarampión». P. falciparum: «A la SE N° N … casos importados … En X se identificó P. falciparum»
// (o «… en X la especie Plasmodium falciparum»). Sólo se registra lo que la frase imprime, con evidencia por boletín:
// archivo, página, frase y cifra. Una nota que no nombra la especie no se registra (no se supone cero).
//
// Lee el texto de cada boletín (pdftotext -layout, el mismo boletin.txt de cada foto del radar), un archivo por
// boletín llamado AAAA_semNN.txt. Escribe assets/boletin/history/notas_acumulados.json. Determinista.
//
// Uso:
//   node scripts/radar_notas_acumulados.mjs --txt-dir DIR [--root DIR] [--check]   reconstrucción completa
//   node scripts/radar_notas_acumulados.mjs --agrega <boletin.txt> --boletin AAAA_semNN [--root DIR]
//       agrega (o reemplaza) un boletín; boletin_semana_activa.py lo corre con el boletin.txt de cada foto.

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ARCHIVO = 'assets/boletin/history/notas_acumulados.json';

const PALABRAS = { cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8,
  nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciséis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20 };
const cifra = (t) => {
  const s = String(t).trim().toLowerCase();
  if (/^\d{1,3}(?:[ ,]\d{3})*$|^\d+$/.test(s)) return Number(s.replace(/[ ,]/g, ''));
  return Object.hasOwn(PALABRAS, s) ? PALABRAS[s] : null;
};
const plano = (t) => t.replace(/ﬁ/g, 'fi').replace(/\s+/g, ' ');

export const SERIES = Object.freeze({
  sarampion: {
    categoria: 'p10b2', nombre: 'Sarampión',
    descripcion: 'Casos confirmados de sarampión acumulados en el año, nacional, según la nota del cuadro de enfermedades prevenibles por vacunación.',
    buscar(page) {
      const m = page.match(/A la SE\.?\s*(\d{1,2}),?\s*se registran\s*(\d{1,3}(?:[ ,]\d{3})*|\d+)\s*casos confirmados de sarampi[oó]n/i);
      return m ? { se_impresa: Number(m[1]), acumulado: cifra(m[2]), frase: m[0] } : null;
    },
  },
  falciparum: {
    categoria: 'p33b1', nombre: 'Paludismo por Plasmodium falciparum',
    descripcion: 'Casos importados de paludismo por P. falciparum confirmados por laboratorio, acumulados en el año, nacional, según la nota del cuadro de paludismo.',
    buscar(page) {
      const m = page.match(/A la (?:SE N°|semana epidemiológica No\.?)\s*(\d{1,2})\s*se (?:tienen|han identificado)\s*(\S+)\s*casos importados[^.]*\.\s*(En .{0,220})/i);
      if (!m) return null;
      // La oración de especies termina en el primer punto que no es la abreviatura «P.».
      const especies = m[3].split(/(?<!\bP)\.\s/)[0];
      const f = especies.match(/en\s+(\S+)\s+(?:se identificó\s+)?(?:la especie\s+)?(?:P\.|Plasmodium)\s*falciparum/i);
      if (!f) return null;
      const n = cifra(f[1]);
      return n === null ? null : { se_impresa: Number(m[1]), acumulado: n, frase: `${m[0].slice(0, m[0].length - m[3].length)}${especies}.`.replace(/\.\.$/, '.') };
    },
  },
});

/** Evidencia de un boletín (texto completo con saltos de página \f): un registro por serie hallada. */
export function leerBoletin(texto, boletin) {
  const [, anio, semana] = boletin.match(/^(\d{4})_sem(\d{2})$/).map(Number);
  const out = {};
  texto.split('\f').forEach((page, i) => {
    const flat = plano(page);
    for (const [k, s] of Object.entries(SERIES)) {
      if (out[k]) continue;
      const r = s.buscar(flat);
      if (r && r.acumulado !== null) out[k] = { boletin, anio, semana, pagina: i + 1, archivo: `${boletin}.txt`, ...r };
    }
  });
  return out;
}

function documento(puntosPorSerie) {
  const series = {};
  for (const [k, s] of Object.entries(SERIES)) {
    const puntos = (puntosPorSerie[k] ?? []).sort((a, b) => a.anio - b.anio || a.semana - b.semana);
    series[k] = { categoria: s.categoria, nombre: s.nombre, descripcion: s.descripcion, puntos };
  }
  return { schema: 'radar_notas_acumulados.v1',
    nota: 'Cifras impresas en las notas del boletín (no en el cuadro estatal); el periodo es la semana del boletín y se_impresa es la semana que dice la frase.',
    series };
}

const texto = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

export function reconstruir(txtDir) {
  const por = {};
  for (const f of readdirSync(txtDir).filter((x) => /^\d{4}_sem\d{2}\.txt$/.test(x)).sort()) {
    const r = leerBoletin(readFileSync(resolve(txtDir, f), 'utf8'), basename(f, '.txt'));
    for (const [k, p] of Object.entries(r)) (por[k] ??= []).push(p);
  }
  return documento(por);
}

export function agregar(doc, textoBoletin, boletin) {
  const por = Object.fromEntries(Object.entries(doc.series).map(([k, s]) => [k, s.puntos.filter((p) => p.boletin !== boletin)]));
  for (const [k, p] of Object.entries(leerBoletin(textoBoletin, boletin))) (por[k] ??= []).push(p);
  return documento(por);
}

function main(argv) {
  const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const root = resolve(arg('--root') ?? new URL('..', import.meta.url).pathname);
  const ruta = resolve(root, ARCHIVO);
  let doc;
  if (arg('--txt-dir')) doc = reconstruir(resolve(arg('--txt-dir')));
  else if (arg('--agrega')) {
    if (!/^\d{4}_sem\d{2}$/.test(arg('--boletin') ?? '')) { console.error('ERROR: --boletin AAAA_semNN'); return 1; }
    const previo = existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')) : documento({});
    doc = agregar(previo, readFileSync(resolve(arg('--agrega')), 'utf8'), arg('--boletin'));
  } else { console.error('ERROR: usa --txt-dir DIR o --agrega <boletin.txt> --boletin AAAA_semNN'); return 1; }
  const t = texto(doc);
  if (argv.includes('--check')) {
    if (!existsSync(ruta) || readFileSync(ruta, 'utf8') !== t) { console.error(`ERROR: ${ARCHIVO} difiere de lo extraído`); return 1; }
    console.log(`${ARCHIVO} al día.`);
    return 0;
  }
  writeFileSync(ruta, t);
  console.log(`${ARCHIVO}: ${Object.entries(doc.series).map(([k, s]) => `${k} ${s.puntos.length} boletines`).join(', ')}.`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = main(process.argv.slice(2));
