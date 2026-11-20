#!/usr/bin/env node
// Pronóstico exploratorio, no validado, de las categorías del radar sin pronóstico publicado
// (orden del autor, alta_b44, 20-nov-2026: «que pueda darme el forecast» en cada ficha del radar).
//
// Lee la foto vigente (assets/boletin/actual.json → data.json) y la serie nacional semanal impresa de cada
// categoría en assets/boletin/history/. Escribe <foto>/pronostico_exploratorio.json. Determinista: sin reloj
// ni red; boletin_semana_activa.py lo corre al activar cada foto semanal.
//
// Método (referencia estacional nacional simple, sin prueba de desempeño ni intervalos):
//   origen = último periodo impreso de la serie nacional semanal; su cifra debe ser numérica.
//   Para cada una de las 52 semanas siguientes (año Y, semana W): media de las cifras de la misma semana W en
//   los años Y-1, Y-2 y Y-3 que la tengan impresa (hasta tres). Con un solo año disponible es la misma semana
//   de ese año anterior. Un guion vale 0 sólo bajo la simbología del boletín (celdas.mjs); una cifra no
//   publicada, «n.d.» o un hueco no cuentan como año disponible.
//   Si el último periodo impreso no tiene cifra, o alguna de las 52 semanas no tiene ningún año base, la
//   categoría queda sin pronóstico y se declara por qué: nunca se rellena con ceros ni con cifras sin base.
//
// Uso: node scripts/radar_pronostico_exploratorio.mjs [--root DIR] [--check]
//   --check no escribe; rc=1 si el archivo difiere de lo generado.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { numero } from '../assets/boletin/celdas.mjs';
import { GRUPOS_NO_MODELABLES, grupoNoModelable } from '../assets/boletin/no_modelables.mjs';
import { ROTULO_EXPLORATORIO, ADVERTENCIA_EXPLORATORIO } from '../assets/boletin/pronostico.mjs';

export const ARCHIVO = 'pronostico_exploratorio.json';
export const HORIZONTE = 52;
export const MAX_ANIOS = 3;

const DIA = 86400000;
function inicioAnio(y) { const j4 = Date.UTC(y, 0, 4); return j4 - new Date(j4).getUTCDay() * DIA; }
export function semanasDelAnio(y) { return Math.round((inicioAnio(y + 1) - inicioAnio(y)) / (7 * DIA)); }
/** Semana epidemiológica (domingo a sábado, regla del 4 de enero) desplazada k semanas. */
export function semanaMas(y, w, k) {
  const t = inicioAnio(y) + (w - 1 + k) * 7 * DIA;
  let a = new Date(t).getUTCFullYear() + 1;
  while (inicioAnio(a) > t) a--;
  return [a, Math.floor((t - inicioAnio(a)) / (7 * DIA)) + 1];
}
export const inicioSemana = (y, w) => new Date(inicioAnio(y) + (w - 1) * 7 * DIA).toISOString().slice(0, 10);

const minusculaInicial = (t) => t.charAt(0).toLowerCase() + t.slice(1);

/** Motivo por el que la categoría no tiene pronóstico publicado. */
export function motivoSinModelo(e) {
  const g = grupoNoModelable(e);
  if (g) return `No modelable (${GRUPOS_NO_MODELABLES[g].etiqueta.toLowerCase()}): ${minusculaInicial(e.reason)}`;
  if (e.status === 'Rechazada') {
    return 'Rechazada: su portafolio no superó la prueba única de 2025 y no se publica; la evidencia está en la sección de analizados y rechazados.';
  }
  return `Sin pronóstico publicado (estado en el radar: ${e.status}).`;
}

/** Categorías del radar sin pronóstico publicado: no agregadas y sin entrada de la plataforma. */
export const categoriasSinRelease = (diseases) => diseases.filter((e) => !e.aggregate && !e.platform_id);

/** Pronóstico exploratorio de una serie (puntos del histórico). Devuelve el registro público de la categoría. */
export function pronosticarSerie(e, puntos) {
  const valor = new Map();
  for (const p of puntos) valor.set(`${p.y}-${p.w}`, numero(p.n?.[0], e.guion, p.y));
  const base = {
    id: e.id, nombre: e.name, codigo: e.code, estado_radar: e.status, motivo_sin_modelo: motivoSinModelo(e),
  };
  if (!puntos.length) {
    return { ...base, pronostico: null, sin_pronostico: 'La serie nacional semanal impresa no tiene periodos en el archivo histórico.' };
  }
  const ultimo = puntos.reduce((a, p) => (p.y > a.y || (p.y === a.y && p.w > a.w) ? p : a));
  const origen = [ultimo.y, ultimo.w];
  const conCifra = puntos.filter((p) => valor.get(`${p.y}-${p.w}`) !== null).length;
  if (valor.get(`${ultimo.y}-${ultimo.w}`) === null) {
    return { ...base, origen, puntos_con_cifra: conCifra, pronostico: null,
      sin_pronostico: `El último periodo impreso (${ultimo.y}-W${String(ultimo.w).padStart(2, '0')}) no tiene cifra semanal numérica (guion de cifra no publicada, «n.d.» o celda vacía): no hay base actual para una referencia estacional.` };
  }
  const semanas = [];
  let sinBase = 0;
  for (let k = 1; k <= HORIZONTE; k++) {
    const [y, w] = semanaMas(ultimo.y, ultimo.w, k);
    const anios = [];
    const valores = [];
    for (let a = y - 1; a >= y - MAX_ANIOS; a--) {
      const v = valor.get(`${a}-${w}`);
      if (v !== undefined && v !== null) { anios.push(a); valores.push(v); }
    }
    if (!valores.length) { sinBase++; semanas.push({ y, w, ds: inicioSemana(y, w), valor: null, anios: [] }); continue; }
    const media = valores.reduce((s, v) => s + v, 0) / valores.length;
    semanas.push({ y, w, ds: inicioSemana(y, w), valor: Math.round(media * 10) / 10, anios });
  }
  if (sinBase) {
    return { ...base, origen, puntos_con_cifra: conCifra, pronostico: null,
      sin_pronostico: `${sinBase} de las ${HORIZONTE} semanas siguientes al origen no tienen la misma semana impresa en ninguno de los ${MAX_ANIOS} años anteriores: la historia semanal no alcanza y no se rellena con ceros.` };
  }
  const usados = [...new Set(semanas.flatMap((s) => s.anios))].sort((a, b) => a - b);
  return { ...base, origen, puntos_con_cifra: conCifra, anios_usados: usados,
    semanas_con_un_anio: semanas.filter((s) => s.anios.length === 1).length,
    pronostico: semanas };
}

/** Documento completo para la foto (data, índice histórico, lector de series). */
export function construir(data, indice, leerSerie) {
  const cats = categoriasSinRelease(data.diseases);
  const categorias = {};
  for (const e of cats) {
    const ref = indice.series?.[e.id];
    categorias[e.id] = pronosticarSerie(e, ref ? leerSerie(ref.path).points : []);
  }
  const con = Object.values(categorias).filter((c) => c.pronostico).length;
  return {
    schema: 'radar_pronostico_exploratorio.v1',
    rotulo: ROTULO_EXPLORATORIO,
    advertencia: ADVERTENCIA_EXPLORATORIO,
    metodo: {
      nombre: 'media_estacional_misma_semana',
      descripcion: `Para cada una de las ${HORIZONTE} semanas siguientes al último periodo impreso: media de la misma semana epidemiológica en los años anteriores disponibles (hasta ${MAX_ANIOS}); con un solo año, la misma semana del año anterior disponible. Serie nacional semanal impresa del boletín; un guion vale 0 sólo bajo la simbología del boletín y una cifra no publicada no cuenta.`,
      horizonte_semanas: HORIZONTE,
      max_anios: MAX_ANIOS,
      intervalos: false,
      prueba_de_desempeno: false,
      ambito: 'nacional',
    },
    fuente: {
      foto: `${data.meta.year}-W${String(data.meta.week).padStart(2, '0')}`,
      foto_pdf_sha256: data.meta.pdf_sha256,
      historia_comprobada: indice.checked ?? null,
      historia_fuentes: indice.source_count ?? null,
    },
    conteo: { categorias: cats.length, con_pronostico: con, sin_historia_suficiente: cats.length - con },
    categorias,
  };
}

export function generar(root) {
  const actual = JSON.parse(readFileSync(resolve(root, 'assets/boletin/actual.json'), 'utf8'));
  const data = JSON.parse(readFileSync(resolve(root, actual.carpeta, 'data.json'), 'utf8'));
  const indice = JSON.parse(readFileSync(resolve(root, 'assets/boletin/history/index.json'), 'utf8'));
  const doc = construir(data, indice, (ruta) => JSON.parse(readFileSync(resolve(root, ruta.replace(/^\//, '')), 'utf8')));
  return { ruta: resolve(root, actual.carpeta, ARCHIVO), texto: `${JSON.stringify(doc, null, 1)}\n`, doc };
}

function main(argv) {
  const i = argv.indexOf('--root');
  const root = resolve(i >= 0 ? argv[i + 1] : new URL('..', import.meta.url).pathname);
  if (!existsSync(resolve(root, 'assets/boletin/history/index.json'))) {
    console.error('ERROR: falta assets/boletin/history/index.json');
    return 1;
  }
  const { ruta, texto, doc } = generar(root);
  if (argv.includes('--check')) {
    const previo = existsSync(ruta) ? readFileSync(ruta, 'utf8') : '';
    if (previo !== texto) { console.error(`ERROR: ${ruta} difiere de lo generado`); return 1; }
    console.log(`${ARCHIVO} al día: ${doc.conteo.con_pronostico}/${doc.conteo.categorias} con pronóstico exploratorio.`);
    return 0;
  }
  writeFileSync(ruta, texto);
  console.log(`${ruta}: ${doc.conteo.con_pronostico} de ${doc.conteo.categorias} categorías con pronóstico exploratorio; ${doc.conteo.sin_historia_suficiente} sin historia suficiente.`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = main(process.argv.slice(2));
