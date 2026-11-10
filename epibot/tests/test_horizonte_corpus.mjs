// Auditoría 9-nov-2026, R3: el corte de datos (origen) no es la primera semana pronosticada. Cada
// tarjeta nacional de un release nombra ambos extremos del horizonte y aclara qué es el corte.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import { readFileSync } from 'fs';
import { tmpdir } from 'os';
import { resolve } from 'path';

import { buildChunks } from '../scripts/lib/corpus.mjs';

const ROOT = resolve(import.meta.dirname, '..', '..');
const semana = ([a, s]) => `${a}-W${String(s).padStart(2, '0')}`;

test('cada release nombra la primera y la última semana pronosticadas y no confunde el corte', () => {
  const { chunks } = buildChunks({});
  const catalogo = JSON.parse(readFileSync(resolve(ROOT, 'publication', 'catalog.json'), 'utf-8'));
  const visibles = catalogo.releases.filter((r) => r.visible && r.lifecycle === 'published');
  assert.ok(visibles.length >= 29);
  for (const r of visibles) {
    const v = JSON.parse(readFileSync(resolve(ROOT, 'publication', r.disease_id, 'vista.json'), 'utf-8'));
    const c = chunks.find((x) => x.id === `release:${r.disease_id}:${r.release_id}:nacional`);
    assert.ok(c, r.disease_id);
    const corte = semana(v.origin);
    assert.match(c.text, new RegExp(`${corte} es el corte de datos, no una semana pronosticada`));
    assert.doesNotMatch(c.text, new RegExp(`van de ${corte}`), r.disease_id);
  }
});

test('el horizonte de 52 semanas cruza el año con el calendario MMWR', () => {
  const c = buildChunks({}).chunks.find((x) => x.id.startsWith('release:linfoma_hodgkin_c81:') && x.id.endsWith(':nacional'));
  assert.match(c.text, /van de 2026-W42 \(semana del 19 de octubre de 2026\) a 2027-W41 \(semana del 11 de octubre de 2027\)/);
});

test('la cronología declarada en el catálogo va en cada fragmento generado de ese release y sólo en él', () => {
  const { chunks } = buildChunks({});
  const NOTA = /boletín 43, que trae la semana 2026-W42, se publicó el 9 de noviembre de 2026.*no cuenta como prospectiva respecto de la información/;
  const asma = chunks.filter((x) => /^release:asma_j45:[^:]+:(nacional|estados|motores)$/.test(x.id));
  assert.equal(asma.length, 3);
  for (const c of asma) assert.match(c.text, NOTA, c.id);
  for (const c of chunks.filter((x) => x.id.startsWith('release:') && !x.id.startsWith('release:asma_j45:'))) {
    assert.doesNotMatch(c.text, /boletín 43, que trae/, c.id);
  }
});

test('el prompt distingue el corte de datos del inicio del pronóstico', () => {
  const rag = readFileSync(resolve(ROOT, 'epibot', 'netlify', 'functions', 'rag.mjs'), 'utf-8');
  assert.match(rag, /«datos hasta» o «corte» es la última semana observada, NO el inicio del pronóstico/);
});

test('un control conserva su explicación cuando ya hay semanas observadas', () => {
  // Ensayo del paso semanal (9-nov-2026): con 1/4 la tarjeta nacional de un control perdía el aviso.
  const { cpSync, mkdtempSync, rmSync, writeFileSync } = fs;
  const tmp = mkdtempSync(resolve(tmpdir(), 'control-oos-'));
  try {
    cpSync(resolve(ROOT, 'publication'), resolve(tmp, 'publication'), { recursive: true });
    cpSync(resolve(ROOT, 'Reports', 'publication'), resolve(tmp, 'Reports', 'publication'), { recursive: true });
    const ruta = resolve(tmp, 'publication', 'cancer_rinon_c64', 'vista.json');
    const v = JSON.parse(readFileSync(ruta, 'utf-8'));
    v.series['nacional|mx|general'].oos = {
      semanas: 1, smape: 7.4, mae: 4, sesgo_pct: -7.1, observado_total: 56, pronostico_total: 52,
    };
    writeFileSync(ruta, JSON.stringify(v));
    const pointers = JSON.parse(readFileSync(resolve(tmp, 'publication', 'pointers.json'), 'utf-8')).pointers;
    const { chunks } = buildChunks({ publicationRoot: tmp, publicationMode: 'public', publicationPointers: pointers });
    const c = chunks.find((x) => x.id.startsWith('release:cancer_rinon_c64:') && x.id.endsWith(':nacional'));
    assert.match(c.text, /en 1 semana ya observada tras el origen/);
    assert.doesNotMatch(c.text, /1 semanas/);
    assert.match(c.text, /Es el control estacional/);
    assert.match(c.text, /No debe presentarse como validado/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
