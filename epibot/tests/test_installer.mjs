/**
 * test_installer.mjs — C7.6-ADAPTERS-A: el instalador genérico y la vista de release.
 *
 * Lo que protege: que entregar un shard a los consumidores sea una operación con contrato —
 * inventario cerrado, idempotente, que no pisa lo ajeno y que deja el destino previo intacto si
 * falla— y que la vista muestre la etiqueta de validación junto a cualquier cifra.
 *
 * Todo ocurre en temporales. El shard real del backend se usa sólo si se inyecta `C7_SHARD_ROOT`.
 *
 * Uso: node --test tests/test_installer.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { CandidateError } from '../scripts/lib/candidate.mjs';
import {
  INSTALL_MANIFEST,
  MODE_CANDIDATE,
  MODE_PUBLIC,
  installShard,
  inventory,
  readCatalog,
} from '../scripts/lib/installer.mjs';
import {
  UNCERTAINTY_LABEL,
  buildReleaseView,
  installedReleases,
  publicReleases,
} from '../scripts/lib/publication_view.mjs';
import { buildChunks } from '../scripts/lib/corpus.mjs';

const DISEASE = 'padecimiento_x';
const RELEASE = 'padecimiento_x_release_abc123456789';
const ETIQUETA = 'Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos';

function estado(extra = {}) {
  return {
    schema: 'prospective_status.v2',
    gate_digest: 'a'.repeat(64),
    evaluation_digest: 'b'.repeat(64),
    status_digest: 'c'.repeat(64),
    observation_dataset_id: 'obs_dataset',
    verdict: 'INCOMPLETE',
    weeks_required: 4,
    weeks_available: 0,
    completed_weeks: [],
    target_weeks: [[2026, 27], [2026, 28], [2026, 29], [2026, 30]],
    label: ETIQUETA,
    ...extra,
  };
}

/** Shard sintético con los seis archivos que consume el instalador. */
function fabricarShard({ lifecycle = 'trained', status = estado(), label = status.label } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'shard-'));
  const root = join(dir, DISEASE, RELEASE);
  mkdirSync(join(root, 'web'), { recursive: true });
  mkdirSync(join(root, 'reports'), { recursive: true });
  mkdirSync(join(root, 'epibot', 'corpus'), { recursive: true });

  const comun = {
    schema: 'publication_shard.v1',
    disease_id: DISEASE,
    release_id: RELEASE,
    display_name: 'Padecimiento X',
    lifecycle,
    interval_method: 'none',
    uncertainty_available: false,
    rows: 2,
    publication_status: status,
    publication_label: label,
  };
  writeFileSync(join(root, 'shard_manifest.json'), JSON.stringify(comun));
  writeFileSync(join(root, 'web', 'manifest.json'), JSON.stringify(comun));
  const csv =
    'ds,epi_year,epi_week,yhat_cases,yhat_lower,yhat_upper\n' +
    '2026-07-05,2026,27,10,,\n2026-07-12,2026,28,11,,\n';
  writeFileSync(join(root, 'web', 'series.csv'), csv);
  writeFileSync(join(root, 'reports', 'report.md'), `# informe\n\n**${label}**\n`);
  writeFileSync(join(root, 'reports', 'forecast_products.csv'), csv);
  writeFileSync(join(root, 'epibot', 'knowledge.json'), JSON.stringify({ release: comun }));
  writeFileSync(join(root, 'epibot', 'corpus', `${DISEASE}.md`), `# ${DISEASE}\n\n${label}\n`);
  return { dir, root };
}

const conShardYDestino = (fn, opciones = {}) => {
  const { dir, root } = fabricarShard(opciones);
  const destino = mkdtempSync(join(tmpdir(), 'install-'));
  try {
    return fn(root, destino);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(destino, { recursive: true, force: true });
  }
};

// ── Instalación candidate ─────────────────────────────────────────────────────────────────────
test('instala los seis archivos en las rutas del contrato', () => {
  conShardYDestino((shard, destino) => {
    const r = installShard(shard, destino);
    const esperadas = [
      `publication/${DISEASE}/${RELEASE}/manifest.json`,
      `publication/${DISEASE}/${RELEASE}/series.csv`,
      `publication/${DISEASE}/${RELEASE}/knowledge.json`,
      `publication/${DISEASE}/${RELEASE}/corpus/${DISEASE}.md`,
      `Reports/publication/${DISEASE}/${RELEASE}/report.md`,
      `Reports/publication/${DISEASE}/${RELEASE}/forecast_products.csv`,
    ];
    assert.deepEqual(r.files.sort(), esperadas.sort());
    for (const ruta of esperadas) assert.ok(existsSync(join(destino, ruta)), ruta);
    assert.ok(existsSync(join(destino, 'publication', DISEASE, RELEASE, INSTALL_MANIFEST)));
    assert.equal(r.manifest.mode, MODE_CANDIDATE);
    assert.deepEqual(r.manifest.channels, ['epibot', 'reports', 'web']);
  });
});

test('el manifiesto sella los digests de entradas y salidas', () => {
  conShardYDestino((shard, destino) => {
    const { manifest } = installShard(shard, destino);
    assert.equal(Object.keys(manifest.inputs).length, 6);
    assert.equal(Object.keys(manifest.outputs).length, 6);
    for (const [entrada, salida] of [
      ['web/series.csv', `publication/${DISEASE}/${RELEASE}/series.csv`],
      ['reports/report.md', `Reports/publication/${DISEASE}/${RELEASE}/report.md`],
    ]) {
      assert.equal(manifest.inputs[entrada], manifest.outputs[salida], 'copiar no puede alterar bytes');
    }
  });
});

test('reinstalar es idempotente: los mismos bytes', () => {
  conShardYDestino((shard, destino) => {
    installShard(shard, destino);
    const primero = inventory(destino);
    installShard(shard, destino);
    assert.deepEqual(inventory(destino), primero);
  });
});

test('dos instalaciones en raíces distintas son byte-idénticas', () => {
  const { dir, root } = fabricarShard();
  const a = mkdtempSync(join(tmpdir(), 'install-a-'));
  const b = mkdtempSync(join(tmpdir(), 'install-b-'));
  try {
    installShard(root, a);
    installShard(root, b);
    assert.deepEqual(inventory(a), inventory(b), 'la raíz no puede filtrarse en el contenido');
  } finally {
    for (const d of [dir, a, b]) rmSync(d, { recursive: true, force: true });
  }
});

test('un archivo ajeno al inventario ni se borra ni se sobrescribe', () => {
  conShardYDestino((shard, destino) => {
    const ajeno = join(destino, 'Reports', 'publication', 'otro_padecimiento', 'nota.md');
    mkdirSync(join(destino, 'Reports', 'publication', 'otro_padecimiento'), { recursive: true });
    writeFileSync(ajeno, 'contenido de otro release\n');
    installShard(shard, destino);
    assert.equal(readFileSync(ajeno, 'utf-8'), 'contenido de otro release\n');
  });
});

test('el catálogo hace upsert por (disease, release) y no pisa otros', () => {
  conShardYDestino((shard, destino) => {
    installShard(shard, destino);
    // Un release ajeno ya presente en el catálogo tiene que sobrevivir.
    const ruta = join(destino, 'publication', 'catalog.json');
    const previo = JSON.parse(readFileSync(ruta, 'utf-8'));
    previo.releases.push({ disease_id: 'otro', release_id: 'otro_r', visible: false });
    writeFileSync(ruta, JSON.stringify(previo));

    installShard(shard, destino);
    const releases = readCatalog(destino).releases;
    assert.equal(releases.filter((r) => r.release_id === RELEASE).length, 1, 'no duplica el propio');
    assert.equal(releases.filter((r) => r.release_id === 'otro_r').length, 1, 'conserva el ajeno');
  });
});

test('si falla a mitad, el destino previo queda intacto y sin restos', () => {
  const { dir, root } = fabricarShard();
  const destino = mkdtempSync(join(tmpdir(), 'install-'));
  try {
    installShard(root, destino);
    const antes = inventory(destino);
    rmSync(join(root, 'reports', 'report.md'));      // el shard se rompe entre instalaciones
    assert.throws(() => installShard(root, destino), /no trae reports\/report\.md/);
    assert.deepEqual(inventory(destino), antes, 'la instalación previa no se tocó');
    assert.ok(!existsSync(`${destino}.installing`), 'sin temporales colgando');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(destino, { recursive: true, force: true });
  }
});

// ── Modo público ──────────────────────────────────────────────────────────────────────────────
test('public se rechaza mientras el lifecycle sea trained', () => {
  conShardYDestino((shard, destino) => {
    assert.throws(
      () => installShard(shard, destino, { mode: MODE_PUBLIC, pointerReleaseId: RELEASE }),
      /exige lifecycle published/,
    );
  });
});

test('public exige además un puntero activo al MISMO release', () => {
  conShardYDestino(
    (shard, destino) => {
      assert.throws(
        () => installShard(shard, destino, { mode: MODE_PUBLIC, pointerReleaseId: null }),
        /puntero activo/,
      );
      assert.throws(
        () => installShard(shard, destino, { mode: MODE_PUBLIC, pointerReleaseId: 'otro_release' }),
        /puntero activo/,
      );
      const r = installShard(shard, destino, { mode: MODE_PUBLIC, pointerReleaseId: RELEASE });
      assert.equal(r.manifest.mode, MODE_PUBLIC);
      assert.equal(publicReleases(destino).length, 1, 'sólo entonces es visible');
    },
    { lifecycle: 'published' },
  );
});

test('un candidate no aparece en la superficie pública', () => {
  conShardYDestino((shard, destino) => {
    installShard(shard, destino);
    assert.deepEqual(publicReleases(destino), []);
    assert.equal(installedReleases(destino).length, 1, 'sí se ve en staging');
    assert.equal(installedReleases(destino)[0].visible, false);
  });
});

// ── Vista genérica ────────────────────────────────────────────────────────────────────────────
test('la vista resuelve por catálogo y muestra etiqueta, point-only y sin banda', () => {
  conShardYDestino((shard, destino) => {
    installShard(shard, destino);
    const vista = buildReleaseView(destino, { diseaseId: DISEASE, releaseId: RELEASE });
    assert.equal(vista.validationLabel, ETIQUETA);
    assert.equal(vista.uncertaintyLabel, UNCERTAINTY_LABEL);
    assert.equal(vista.band, null);
    assert.equal(vista.isPubliclyVisible, false);
    assert.equal(vista.inGallery, false, 'gallery_enabled=false no inserta en la galería');
    assert.equal(vista.rows, 2);
    assert.deepEqual([vista.verdict, vista.weeksAvailable, vista.weeksRequired], ['INCOMPLETE', 0, 4]);
    assert.ok(existsSync(vista.reports.report), 'Reports sigue siendo un canal aunque no haya galería');
  });
});

test('la vista no conoce ningún padecimiento por su nombre', () => {
  const fuente = readFileSync(new URL('../scripts/lib/publication_view.mjs', import.meta.url), 'utf-8');
  for (const prohibido of ['Obesidad', 'obesidad', 'E66', 'padecimiento_x']) {
    assert.ok(!fuente.includes(prohibido), `${prohibido} no puede estar escrito en la vista`);
  }
});

test('la vista rechaza catálogo, schema, identidad o etiqueta incoherentes', () => {
  conShardYDestino((shard, destino) => {
    installShard(shard, destino);
    assert.throws(
      () => buildReleaseView(destino, { diseaseId: DISEASE, releaseId: 'no_existe' }),
      /el catálogo no declara/,
    );

    const ruta = join(destino, 'publication', DISEASE, RELEASE, INSTALL_MANIFEST);
    const original = readFileSync(ruta, 'utf-8');
    for (const [cambio, patron] of [
      [{ schema: 'publication_install.v2' }, /schema .* no soportado/],
      [{ lifecycle: 'published' }, /lifecycle=.* contradice el catálogo/],
      [{ publication_label: 'otra' }, /publication_label=.* contradice el catálogo/],
    ]) {
      writeFileSync(ruta, JSON.stringify({ ...JSON.parse(original), ...cambio }));
      assert.throws(() => buildReleaseView(destino, { diseaseId: DISEASE, releaseId: RELEASE }), patron);
    }
    writeFileSync(ruta, original);
    assert.ok(buildReleaseView(destino, { diseaseId: DISEASE, releaseId: RELEASE }));
  });
});

// ── EpiBot / RAG ──────────────────────────────────────────────────────────────────────────────
test('buildChunks() sin raíz conserva el corpus público exacto', () => {
  const publico = buildChunks().chunks;
  conShardYDestino((shard, destino) => {
    installShard(shard, destino);
    const deNuevo = buildChunks().chunks;
    assert.deepEqual(deNuevo, publico, 'instalar un candidate no puede mover el corpus público');
  });
});

test('con publicationRoot el corpus suma exactamente el release instalado', () => {
  const publico = buildChunks().chunks.length;
  conShardYDestino((shard, destino) => {
    installShard(shard, destino);
    const { chunks } = buildChunks({ publicationRoot: destino });
    assert.equal(chunks.length, publico + 1);
    const nuevo = chunks[chunks.length - 1];
    assert.equal(nuevo.id, `candidate:${DISEASE}:${RELEASE}`);
    assert.ok(nuevo.text.includes(ETIQUETA), 'el chunk lleva la etiqueta de validación');
    assert.equal(nuevo.url, null, 'un candidate no tiene página donde enlazarse');
  });
});

test('el corpus instalado se resuelve por catálogo, no por directorio', () => {
  conShardYDestino((shard, destino) => {
    installShard(shard, destino);
    const ruta = join(destino, 'publication', 'catalog.json');
    writeFileSync(ruta, JSON.stringify({ schema: 'publication_install.v1', releases: [] }));
    const { chunks } = buildChunks({ publicationRoot: destino });
    assert.equal(chunks.length, buildChunks().chunks.length, 'sin catálogo no hay chunk');
  });
});

// ── Shard real del backend ────────────────────────────────────────────────────────────────────
const RAIZ_REAL = process.env.C7_SHARD_ROOT;

test('shard real: instala, se ve en staging y no en público', { skip: !RAIZ_REAL }, async () => {
  const { findShards } = await import('../scripts/lib/candidate.mjs');
  const [shard] = findShards(RAIZ_REAL);
  const destino = mkdtempSync(join(tmpdir(), 'install-real-'));
  try {
    const r = installShard(shard.root, destino);
    assert.equal(r.manifest.disease_id, shard.diseaseId);
    assert.equal(r.manifest.release_id, shard.releaseId);
    assert.equal(r.files.length, 6);

    const vista = buildReleaseView(destino, { diseaseId: shard.diseaseId, releaseId: shard.releaseId });
    assert.match(vista.validationLabel, /\(0\/4 semanas\)/);
    assert.equal(vista.band, null);
    assert.equal(vista.isPubliclyVisible, false);
    assert.equal(vista.rows, 5772);
    assert.deepEqual(publicReleases(destino), []);

    const { chunks } = buildChunks({ publicationRoot: destino });
    assert.equal(chunks.length, buildChunks().chunks.length + 1);
  } finally {
    rmSync(destino, { recursive: true, force: true });
  }
});
