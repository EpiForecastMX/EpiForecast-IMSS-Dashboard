/**
 * test_installer.mjs — C7.6-ADAPTERS-A: el instalador genérico y la vista de release.
 *
 * Lo que protege: que entregar un shard a los consumidores sea una operación con contrato —
 * origen sellado, release inmutable, catálogo como único commit visible, lectura que verifica
 * digests, modos RAG explícitos y orden independiente del locale— y que la vista muestre la
 * etiqueta de validación junto a cualquier cifra.
 *
 * Todo ocurre en temporales. El shard real del backend se usa sólo si se inyecta `C7_SHARD_ROOT`.
 *
 * Uso: node --test tests/test_installer.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { CandidateError } from '../scripts/lib/candidate.mjs';
import {
  CATALOG_FILE,
  FS_OPS,
  INSTALL_MANIFEST,
  MODE_CANDIDATE,
  MODE_PUBLIC,
  installArtifacts,
  installShard,
  inventory,
  porBytes,
  readCatalog,
  readInstalledRelease,
} from '../scripts/lib/installer.mjs';
import {
  UNCERTAINTY_LABEL,
  buildReleaseView,
  installedReleases,
  publicReleases,
} from '../scripts/lib/publication_view.mjs';
import { RAG_MODE_PUBLIC, RAG_MODE_STAGING, buildChunks } from '../scripts/lib/corpus.mjs';

const DISEASE = 'padecimiento_x';
const RELEASE = 'padecimiento_x_release_abc123456789';
const ETIQUETA = 'Validación prospectiva en curso (0/4 semanas) · pronóstico puntual sin intervalos';
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

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

/** Shard sintético con los seis archivos que consume el instalador y su inventario sellado. */
function fabricarShard({
  lifecycle = 'trained',
  status = estado(),
  label = status.label,
  disease = DISEASE,
  release = RELEASE,
  gallery = false,
} = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'shard-'));
  const root = join(dir, disease, release);
  mkdirSync(join(root, 'web'), { recursive: true });
  mkdirSync(join(root, 'reports'), { recursive: true });
  mkdirSync(join(root, 'epibot', 'corpus'), { recursive: true });

  const comun = {
    schema: 'publication_shard.v1',
    disease_id: disease,
    release_id: release,
    display_name: 'Padecimiento X',
    lifecycle,
    interval_method: 'none',
    uncertainty_available: false,
    rows: 2,
    publication_status: status,
    publication_label: label,
  };
  const csv =
    'ds,epi_year,epi_week,yhat_cases,yhat_lower,yhat_upper\n' +
    '2026-07-05,2026,27,10,,\n2026-07-12,2026,28,11,,\n';
  writeFileSync(join(root, 'web', 'manifest.json'), JSON.stringify({ ...comun, gallery_enabled: gallery }));
  writeFileSync(join(root, 'web', 'series.csv'), csv);
  writeFileSync(join(root, 'reports', 'report.md'), `# informe\n\n**${label}**\n`);
  writeFileSync(join(root, 'reports', 'forecast_products.csv'), csv);
  writeFileSync(join(root, 'epibot', 'knowledge.json'), JSON.stringify({ release: comun }));
  writeFileSync(join(root, 'epibot', 'corpus', `${disease}.md`), `# ${disease}\n\n${label}\n`);
  sellar(root, comun);
  return { dir, root };
}

/** Rehace `shard_manifest.json.files`: el shard real lo trae, y el instalador lo exige. */
function sellar(root, comun) {
  const files = {};
  for (const rel of [
    'web/manifest.json',
    'web/series.csv',
    'reports/report.md',
    'reports/forecast_products.csv',
    'epibot/knowledge.json',
    `epibot/corpus/${comun.disease_id}.md`,
  ]) {
    files[rel] = sha256(readFileSync(join(root, rel)));
  }
  writeFileSync(join(root, 'shard_manifest.json'), JSON.stringify({ ...comun, files }));
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
  const otro = fabricarShard({ disease: 'otro_padecimiento', release: 'otro_release_000000000000' });
  conShardYDestino((shard, destino) => {
    installShard(otro.root, destino);
    installShard(shard, destino);
    installShard(shard, destino);
    const releases = readCatalog(destino).releases;
    assert.equal(releases.filter((r) => r.release_id === RELEASE).length, 1, 'no duplica el propio');
    assert.equal(releases.filter((r) => r.disease_id === 'otro_padecimiento').length, 1, 'conserva el ajeno');
  });
  rmSync(otro.dir, { recursive: true, force: true });
});

// ── Origen sellado (R96-P0-4) ─────────────────────────────────────────────────────────────────
test('un archivo del shard alterado se rechaza ANTES de instalar nada', () => {
  conShardYDestino((shard, destino) => {
    // Mismo número de filas, otro dato: comparar conteos no lo delataría.
    const ruta = join(shard, 'web', 'series.csv');
    writeFileSync(ruta, readFileSync(ruta, 'utf-8').replace(',10,,', ',999999,,'));
    assert.throws(() => installShard(shard, destino), /web\/series\.csv: digest .* no coincide/);
    assert.deepEqual(inventory(destino), {}, 'ni un byte llegó al destino');
  });
});

test('sin inventario `files` el shard no se instala', () => {
  conShardYDestino((shard, destino) => {
    const m = JSON.parse(readFileSync(join(shard, 'shard_manifest.json'), 'utf-8'));
    delete m.files;
    writeFileSync(join(shard, 'shard_manifest.json'), JSON.stringify(m));
    assert.throws(() => installShard(shard, destino), /no trae el inventario/);
  });
});

test('un archivo declarado y ausente se rechaza', () => {
  conShardYDestino((shard, destino) => {
    rmSync(join(shard, 'reports', 'report.md'));
    assert.throws(() => installShard(shard, destino), /el shard no trae reports\/report\.md/);
    assert.deepEqual(inventory(destino), {});
  });
});

// ── Inmutabilidad y commit visible (R96-P0-1) ─────────────────────────────────────────────────
test('una ruta ya existente con otros bytes se RECHAZA, no se sobrescribe', () => {
  conShardYDestino((shard, destino) => {
    const ruta = join(destino, 'publication', DISEASE, RELEASE, 'series.csv');
    mkdirSync(join(destino, 'publication', DISEASE, RELEASE), { recursive: true });
    writeFileSync(ruta, 'otra cosa\n');
    assert.throws(() => installShard(shard, destino), /es inmutable/);
    assert.equal(readFileSync(ruta, 'utf-8'), 'otra cosa\n', 'no lo tocó');
    assert.ok(!existsSync(join(destino, CATALOG_FILE)), 'y no llegó a publicar catálogo');
  });
});

/**
 * Sink que revienta en UNA frontera del destino vivo.
 *
 * `write` cae sobre el temporal `<artefacto>.installing-<token>`; `rename` sobre el artefacto ya
 * en su sitio. Se compara por ruta exacta, no por expresión regular suelta, para que una frontera
 * mal escrita no pase por verde sin haber disparado nunca.
 */
function opsQueFallanEn(op, relativa) {
  const esTemporal = (ruta) => ruta.includes(`${relativa}.installing-`);
  const esFinal = (ruta) => ruta.endsWith(`/${relativa}`);
  return {
    mkdir: FS_OPS.mkdir,
    write: (r, d) => {
      if (op === 'write' && esTemporal(r)) throw new Error(`fallo en write ${relativa}`);
      FS_OPS.write(r, d);
    },
    rename: (a, b) => {
      if (op === 'rename' && esFinal(b)) throw new Error(`fallo en rename ${relativa}`);
      FS_OPS.rename(a, b);
    },
    remove: FS_OPS.remove,
  };
}

/** La matriz sale del plan REAL de instalación: 8 artefactos × 2 fronteras = 16 casos. */
const ARTEFACTOS = installArtifacts(DISEASE, RELEASE);
const FRONTERAS = ARTEFACTOS.flatMap((a) => [
  { op: 'write', relativa: a },
  { op: 'rename', relativa: a },
]);

test('la matriz de fallos cubre los 8 artefactos del plan, write y rename', () => {
  assert.equal(ARTEFACTOS.length, 8, 'seis outputs + publication_install.json + catalog.json');
  assert.equal(FRONTERAS.length, 16);
  assert.ok(ARTEFACTOS.includes(CATALOG_FILE) && ARTEFACTOS.some((a) => a.endsWith(INSTALL_MANIFEST)));
});

for (const { op, relativa } of FRONTERAS) {
  test(`un fallo en «${op}:${relativa}» deja catálogo y release visible byte-idénticos`, () => {
    const previo = fabricarShard({ disease: 'ya_visible', release: 'ya_visible_release_00000000' });
    conShardYDestino((shard, destino) => {
      installShard(previo.root, destino);              // un release que YA era visible
      const antes = inventory(destino);

      assert.throws(
        () => installShard(shard, destino, { ops: opsQueFallanEn(op, relativa) }),
        new RegExp(`fallo en ${op} ${relativa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
        'la frontera tiene que disparar de verdad, no pasar de largo',
      );

      const ahora = inventory(destino);
      assert.equal(ahora[CATALOG_FILE], antes[CATALOG_FILE], 'el catálogo no cambió');
      for (const ruta of Object.keys(antes)) {
        assert.equal(ahora[ruta], antes[ruta], `${ruta} cambió y era del release ya visible`);
      }
      // Lo que quedara a medio instalar no lo referencia nadie: el catálogo sigue sin nombrarlo.
      assert.deepEqual(
        readCatalog(destino).releases.map((r) => r.release_id),
        ['ya_visible_release_00000000'],
      );
      assert.ok(
        !Object.keys(ahora).some((r) => r.includes('.installing-')),
        'sin temporales colgando',
      );
    });
    rmSync(previo.dir, { recursive: true, force: true });
  });
}

test('tras un fallo, reinstalar completo funciona y no deja residuos', () => {
  conShardYDestino((shard, destino) => {
    assert.throws(
      () => installShard(shard, destino, { ops: opsQueFallanEn('rename', `Reports/publication/${DISEASE}/${RELEASE}/report.md`) }),
      /fallo en rename/,
    );
    const r = installShard(shard, destino);
    assert.equal(r.files.length, 6);
    assert.equal(readCatalog(destino).releases.length, 1);
    assert.ok(!Object.keys(inventory(destino)).some((x) => x.includes('.installing-')));
  });
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
    assert.equal(vista.galleryEnabled, false);
    assert.equal(vista.inGallery, false, 'gallery_enabled=false no inserta en la galería');
    assert.equal(vista.rows, 2);
    assert.deepEqual([vista.verdict, vista.weeksAvailable, vista.weeksRequired], ['INCOMPLETE', 0, 4]);
    assert.ok(existsSync(vista.reports.report), 'Reports sigue siendo un canal aunque no haya galería');
  });
});

test('inGallery se deriva de la metadata, no de una constante', () => {
  // gallery_enabled=true pero todavía candidate: la galería es pública, no privada.
  conShardYDestino(
    (shard, destino) => {
      installShard(shard, destino);
      const v = buildReleaseView(destino, { diseaseId: DISEASE, releaseId: RELEASE });
      assert.equal(v.galleryEnabled, true, 'la metadata se persiste tal cual');
      assert.equal(v.inGallery, false, 'declarada pero invisible → fuera de la galería');
    },
    { gallery: true },
  );
  // gallery_enabled=true y publicado con puntero: entra.
  conShardYDestino(
    (shard, destino) => {
      installShard(shard, destino, { mode: MODE_PUBLIC, pointerReleaseId: RELEASE });
      const v = buildReleaseView(destino, { diseaseId: DISEASE, releaseId: RELEASE });
      assert.equal(v.isPubliclyVisible, true);
      assert.equal(v.inGallery, true, 'y ningún cambio de código hizo falta');
    },
    { gallery: true, lifecycle: 'published' },
  );
  // Publicado pero sin galería declarada: visible en su página, fuera de la galería.
  conShardYDestino(
    (shard, destino) => {
      installShard(shard, destino, { mode: MODE_PUBLIC, pointerReleaseId: RELEASE });
      const v = buildReleaseView(destino, { diseaseId: DISEASE, releaseId: RELEASE });
      assert.equal(v.isPubliclyVisible, true);
      assert.equal(v.inGallery, false);
    },
    { lifecycle: 'published' },
  );
});

test('un shard sin gallery_enabled no se instala: no se adivina', () => {
  conShardYDestino((shard, destino) => {
    const ruta = join(shard, 'web', 'manifest.json');
    const web = JSON.parse(readFileSync(ruta, 'utf-8'));
    delete web.gallery_enabled;
    writeFileSync(ruta, JSON.stringify(web));
    sellar(shard, JSON.parse(readFileSync(join(shard, 'shard_manifest.json'), 'utf-8')));
    assert.throws(() => installShard(shard, destino), /gallery_enabled ausente o no booleano/);
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
      [{ publication_label: 'otra' }, /la etiqueta no coincide con el estado/],
      [{ gallery_enabled: true }, /gallery_enabled=.* contradice el catálogo/],
      [{ sobra: 1 }, /forma inesperada/],
    ]) {
      writeFileSync(ruta, JSON.stringify({ ...JSON.parse(original), ...cambio }));
      assert.throws(() => buildReleaseView(destino, { diseaseId: DISEASE, releaseId: RELEASE }), patron);
    }
    writeFileSync(ruta, original);
    assert.ok(buildReleaseView(destino, { diseaseId: DISEASE, releaseId: RELEASE }));
  });
});

// ── Lectura verificada (R96-P0-4) ─────────────────────────────────────────────────────────────
test('un output alterado o ausente falla en la lectura; no se omite', () => {
  conShardYDestino((shard, destino) => {
    installShard(shard, destino);
    const identidad = { diseaseId: DISEASE, releaseId: RELEASE };
    assert.ok(readInstalledRelease(destino, identidad));

    // Alterado en un canal que la vista ni siquiera abre: da igual, el release es uno solo.
    const informe = join(destino, 'Reports', 'publication', DISEASE, RELEASE, 'report.md');
    const original = readFileSync(informe);
    writeFileSync(informe, '# informe alterado\n');
    assert.throws(() => readInstalledRelease(destino, identidad), /digest .* no coincide/);
    assert.throws(() => buildReleaseView(destino, identidad), /digest .* no coincide/);
    assert.throws(
      () => buildChunks({ publicationRoot: destino, publicationMode: RAG_MODE_STAGING }),
      /digest .* no coincide/,
    );

    writeFileSync(informe, original);
    rmSync(join(destino, 'publication', DISEASE, RELEASE, 'knowledge.json'));
    assert.throws(() => readInstalledRelease(destino, identidad), /ausente del destino/);
  });
});

test('una entrada de catálogo escrita a mano e incompleta se rechaza', () => {
  conShardYDestino((shard, destino) => {
    installShard(shard, destino);
    const ruta = join(destino, CATALOG_FILE);
    const previo = JSON.parse(readFileSync(ruta, 'utf-8'));
    previo.releases.push({ disease_id: 'otro', release_id: 'otro_r', visible: false });
    writeFileSync(ruta, JSON.stringify(previo));
    assert.throws(() => readCatalog(destino), /forma inesperada/);
    assert.throws(() => publicReleases(destino), /forma inesperada/);
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

test('sin modo explícito, un árbol instalado NO entra al índice', () => {
  conShardYDestino((shard, destino) => {
    installShard(shard, destino);
    assert.throws(
      () => buildChunks({ publicationRoot: destino }),
      /exige un modo explícito/,
      'omitir el modo no puede significar «incorpora los candidates»',
    );
    assert.throws(() => buildChunks({ publicationMode: RAG_MODE_STAGING }), CandidateError);
  });
});

test('en modo staging entra el candidate; en modo público, no', () => {
  const publico = buildChunks().chunks.length;
  conShardYDestino((shard, destino) => {
    installShard(shard, destino);

    const staging = buildChunks({ publicationRoot: destino, publicationMode: RAG_MODE_STAGING }).chunks;
    assert.equal(staging.length, publico + 1);
    const nuevo = staging[staging.length - 1];
    assert.equal(nuevo.id, `candidate:${DISEASE}:${RELEASE}`);
    assert.ok(nuevo.text.includes(ETIQUETA), 'el chunk lleva la etiqueta de validación');
    assert.equal(nuevo.url, null, 'un candidate no tiene página donde enlazarse');

    const enPublico = buildChunks({ publicationRoot: destino, publicationMode: RAG_MODE_PUBLIC }).chunks;
    assert.equal(enPublico.length, publico, 'un candidate jamás responde en producción');
  });
});

test('en modo público entran sólo visible + public + published + puntero', () => {
  const publico = buildChunks().chunks.length;
  conShardYDestino(
    (shard, destino) => {
      installShard(shard, destino, { mode: MODE_PUBLIC, pointerReleaseId: RELEASE });
      const sinPuntero = buildChunks({ publicationRoot: destino, publicationMode: RAG_MODE_PUBLIC }).chunks;
      assert.equal(sinPuntero.length, publico, 'sin puntero declarado no entra');

      const otroPuntero = buildChunks({
        publicationRoot: destino,
        publicationMode: RAG_MODE_PUBLIC,
        publicationPointers: { [DISEASE]: 'otro_release' },
      }).chunks;
      assert.equal(otroPuntero.length, publico, 'un puntero a otro release tampoco');

      const conPuntero = buildChunks({
        publicationRoot: destino,
        publicationMode: RAG_MODE_PUBLIC,
        publicationPointers: { [DISEASE]: RELEASE },
      }).chunks;
      assert.equal(conPuntero.length, publico + 1);
      assert.equal(
        conPuntero[conPuntero.length - 1].url,
        `../publication/${DISEASE}/${RELEASE}/`,
        'ya publicado, sí tiene página donde enlazarse',
      );
    },
    { lifecycle: 'published' },
  );
});

test('el corpus instalado se resuelve por catálogo, no por directorio', () => {
  conShardYDestino((shard, destino) => {
    installShard(shard, destino);
    const ruta = join(destino, CATALOG_FILE);
    writeFileSync(ruta, JSON.stringify({ schema: 'publication_install.v1', releases: [] }));
    const { chunks } = buildChunks({ publicationRoot: destino, publicationMode: RAG_MODE_STAGING });
    assert.equal(chunks.length, buildChunks().chunks.length, 'sin catálogo no hay chunk');
  });
});

// ── Orden independiente del locale (R96-P1-2) ─────────────────────────────────────────────────
test('el catálogo se ordena por bytes: dos locales, los MISMOS bytes', () => {
  // 'Alfa' < 'zeta' < 'ähnlich' en UTF-8; localeCompare los reordena distinto en en-US y sv-SE.
  const shards = ['Alfa_x', 'zeta_x', 'ähnlich_x'].map((d, i) =>
    fabricarShard({ disease: d, release: `${d}_release_00000000000${i}` }),
  );
  const raices = [];
  const guion = `
    import { installShard, readCatalog } from ${JSON.stringify(new URL('../scripts/lib/installer.mjs', import.meta.url).href)};
    const [destino, ...shards] = process.argv.slice(1);   // con --eval no hay ruta de script
    for (const s of shards) installShard(s, destino);
    process.stdout.write(readCatalog(destino).releases.map((r) => r.disease_id).join(','));
  `;
  try {
    for (const locale of ['en_US.UTF-8', 'sv_SE.UTF-8']) {
      const destino = mkdtempSync(join(tmpdir(), 'install-locale-'));
      raices.push(destino);
      const orden = execFileSync(
        process.execPath,
        ['--input-type=module', '--eval', guion, '--', destino, ...shards.map((s) => s.root)],
        { env: { ...process.env, LANG: locale, LC_ALL: locale }, encoding: 'utf-8' },
      );
      assert.equal(orden, 'Alfa_x,zeta_x,ähnlich_x', `orden binario bajo ${locale}`);
    }
    const [a, b] = raices;
    assert.equal(
      readFileSync(join(a, CATALOG_FILE), 'utf-8'),
      readFileSync(join(b, CATALOG_FILE), 'utf-8'),
      'el locale de la máquina no puede cambiar los bytes de un artefacto',
    );
    assert.notEqual(
      ['Alfa_x', 'zeta_x', 'ähnlich_x'].slice().sort((x, y) => x.localeCompare(y, 'en-US')).join(','),
      'Alfa_x,zeta_x,ähnlich_x',
      'y el orden anterior sí dependía del locale (si no, la prueba no probaría nada)',
    );
  } finally {
    for (const d of [...raices, ...shards.map((s) => s.dir)]) rmSync(d, { recursive: true, force: true });
  }
});

test('porBytes ordena por UTF-8, no por ICU', () => {
  const claves = ['zeta', 'ähnlich', 'Alfa', 'alfa'];
  assert.deepEqual(claves.slice().sort(porBytes), ['Alfa', 'alfa', 'zeta', 'ähnlich']);
});

// ── Shard real del backend ────────────────────────────────────────────────────────────────────
const RAIZ_REAL = process.env.C7_SHARD_ROOT;

test('shard real: instala, se ve en staging y no en público', { skip: !RAIZ_REAL }, async () => {
  const { findShards } = await import('../scripts/lib/candidate.mjs');
  const [shard] = findShards(RAIZ_REAL);
  const sourceManifest = JSON.parse(readFileSync(join(shard.root, 'shard_manifest.json'), 'utf8'));
  const destino = mkdtempSync(join(tmpdir(), 'install-real-'));
  const identidad = { diseaseId: shard.diseaseId, releaseId: shard.releaseId };
  try {
    const r = installShard(shard.root, destino);
    assert.equal(r.manifest.disease_id, shard.diseaseId);
    assert.equal(r.manifest.release_id, shard.releaseId);
    assert.equal(r.files.length, 6);

    const vista = buildReleaseView(destino, identidad);
    assert.equal(vista.validationLabel, sourceManifest.publication_label);
    assert.equal(vista.band, null);
    assert.equal(vista.isPubliclyVisible, false);
    assert.equal(vista.inGallery, false);
    assert.equal(vista.rows, 5772);
    assert.deepEqual(publicReleases(destino), []);

    const base = buildChunks().chunks.length;
    assert.equal(
      buildChunks({ publicationRoot: destino, publicationMode: RAG_MODE_STAGING }).chunks.length,
      base + 1,
      'staging: 455',
    );
    assert.equal(
      buildChunks({ publicationRoot: destino, publicationMode: RAG_MODE_PUBLIC }).chunks.length,
      base,
      'público: 454, el candidate no responde',
    );

    // Un archivo mutado: vista y RAG lo rechazan.
    const serie = join(destino, 'publication', shard.diseaseId, shard.releaseId, 'series.csv');
    const original = readFileSync(serie);
    writeFileSync(serie, Buffer.concat([original, Buffer.from('\n')]));
    assert.throws(() => buildReleaseView(destino, identidad), /digest .* no coincide/);
    assert.throws(
      () => buildChunks({ publicationRoot: destino, publicationMode: RAG_MODE_STAGING }),
      /digest .* no coincide/,
    );
    writeFileSync(serie, original);

    // Fallo durante el commit: catálogo y release previo byte-idénticos.
    const antes = inventory(destino);
    assert.throws(
      () => installShard(shard.root, destino, { ops: opsQueFallanEn('rename', CATALOG_FILE) }),
      /fallo en rename/,
    );
    assert.deepEqual(inventory(destino), antes);

    // public sin condiciones: rechazado.
    assert.throws(
      () => installShard(shard.root, destino, { mode: MODE_PUBLIC, pointerReleaseId: shard.releaseId }),
      /exige lifecycle published/,
    );
  } finally {
    rmSync(destino, { recursive: true, force: true });
  }
});
