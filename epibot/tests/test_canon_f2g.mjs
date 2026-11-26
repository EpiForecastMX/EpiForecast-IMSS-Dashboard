/**
 * Plan canónico del EpiBot, 2.5 escalón 2 (26-nov-2026): piloto de diez fichas de cita con fuente mexicana (acta de la mesa
 * de fichas clínicas, criterios de aceptación 1 a 5). Textuales respecto de la copia archivada, sin contenido prohibido, con el
 * rótulo del acta primero y en la voz, y sólo visibles con auditoría unánime, activas y vigentes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

globalThis.window = globalThis;
const m = await import('../js/fichas_cita.js');
const clinica = await import('../js/clinica.js');
const { textoHablado } = await import('../js/voice.js');
const archivo = (id) => readFileSync(new URL(`../fichas/archivo/${id}.txt`, import.meta.url), 'utf-8');
const sumas = Object.fromEntries(readFileSync(new URL('../fichas/archivo/SHA256SUMS', import.meta.url), 'utf-8')
  .trim().split('\n').map((l) => { const [h, f] = l.split(/\s+/); return [f.replace(/\.txt$/, ''), h]; }));

test('criterio 1: cada oración y encabezado es subcadena de la copia archivada, y el archivo conserva su sha256', () => {
  assert.equal(m.FICHAS_CITA.length, 10);
  for (const [id, f] of Object.entries(m.FUENTES_CITA)) {
    const h = createHash('sha256').update(archivo(id)).digest('hex');
    assert.equal(h, f.sha256, `${id}: el archivo cambió`);
    assert.equal(sumas[id], f.sha256, `${id}: SHA256SUMS`);
    assert.match(f.url, /^https:\/\/www\.gob\.mx\//, `${id}: piloto sólo con fuente mexicana`);
    assert.match(f.licencia, /Propiedad intelectual/);
  }
  for (const c of m.FICHAS_CITA) {
    const fuente = m.normalizaFuente(archivo(c.fuente));
    for (const o of m.oracionesDe(c)) assert.ok(fuente.includes(m.normalizaFuente(o)), `${c.id}: «${o.slice(0, 50)}…»`);
  }
});

// Criterio 3: analizador de contenido prohibido (fármacos, dosis, plazos, vacunación, alarma, cuándo acudir, tranquilizadoras).
const PROHIBIDO = [
  [/\d/, 'número'], [/\b(paracetamol|ibuprofeno|aspirina|antibi\w+|antivira\w*|oseltamivir|medicament\w+|f[aá]rmac\w+|tratamiento\w*|dosis|tableta\w*|pastilla\w*|jarabe|suero|plata coloidal|repelente)\b/i, 'fármaco o producto'],
  [/\b(horas?|d[ií]as?|semanas?|meses|minutos?|años?)\b/i, 'plazo'], [/\bvacun\w*/i, 'vacunación'],
  [/\b(alarma|urgencia\w*|acud\w+|consult\w+ al m[eé]dico|atenci[oó]n m[eé]dica|unidad de salud)\b/i, 'alarma o cuándo acudir'],
  [/\b(no te preocupes|tranquil\w*|sencill\w+ medidas|podr[aá]s evitar|no es grave|sin dejar secuelas|se cura sol\w*)\b/i, 'frase tranquilizadora'],
  [/\b(debes|deber[aá]s|tienes que)\b/i, 'imperativo personal'],
];
test('criterio 3: ninguna ficha tiene contenido prohibido, y sólo hay contagio y prevención', () => {
  for (const c of m.FICHAS_CITA) {
    assert.ok(['contagio', 'prevencion'].includes(c.tema), c.id);
    const t = [c.encabezado, ...c.pasaje].filter(Boolean).join(' ');
    for (const [re, que] of PROHIBIDO) assert.doesNotMatch(t, re, `${c.id}: ${que}`);
    assert.ok(c.poblacion);
  }
});

test('criterio 5: caducidad a doce meses de la consulta, interruptor de retiro y auditoría unánime para mostrarse', () => {
  for (const c of m.FICHAS_CITA) {
    const f = m.FUENTES_CITA[c.fuente];
    assert.equal(c.caduca, `${Number(f.consultada.slice(0, 4)) + 1}${f.consultada.slice(4)}`, c.id);
    assert.equal(typeof c.activa, 'boolean');
    assert.ok(['pendiente', 'unanime', 'rechazada'].includes(c.auditoria), c.id);
  }
  const c = m.FICHAS_CITA.find((x) => x.id === 'tuberculosis_contagio');
  const antes = { activa: c.activa, auditoria: c.auditoria };
  try {
    c.auditoria = 'unanime'; c.activa = true;
    assert.equal(m.fichaPara('contagio', 'como se contagia la tuberculosis', '2026-11-27'), c);
    assert.equal(m.fichaPara('contagio', 'como se contagia la tuberculosis', '2027-11-26'), null, 'caducada');
    assert.notEqual(m.fichaPara('prevencion', 'como se previene la tuberculosis', '2026-11-27'), c, 'otro tema');
    assert.equal(m.fichaPara('prevencion', 'como se previene la escabiosis', '2026-11-27'), null, 'rechazada por la auditoría');
    c.activa = false;
    assert.equal(m.fichaPara('contagio', 'como se contagia la tuberculosis', '2026-11-27'), null, 'retirada');
    c.activa = true; c.auditoria = 'rechazada';
    assert.equal(m.fichaPara('contagio', 'como se contagia la tuberculosis', '2026-11-27'), null, 'sin unanimidad');
  } finally { Object.assign(c, antes); }
});

test('criterio 4: rótulo del acta primero, cita entre comillas, fuente, alarma no completa, 911 y voz con el rótulo', () => {
  const visibles = m.FICHAS_CITA.filter((x) => x.auditoria === 'unanime' && x.activa);
  const c = visibles[0] || m.FICHAS_CITA.find((x) => x.id === 'escabiosis_prevencion');
  const antes = c.auditoria;
  try {
    c.auditoria = 'unanime';
    const consulta = c.tema === 'contagio' ? `¿cómo se contagia la ${c.id.split('_')[0]}?` : `¿cómo se previene la ${c.id.split('_')[0]}?`;
    const t = clinica.respuestaClinica(consulta);
    const f = m.FUENTES_CITA[c.fuente];
    assert.ok(t.startsWith(`**Cita textual de ${f.institucion}, «${f.titulo}», consultada el 26 de noviembre de 2026.** La eligió y ` +
      'la cotejó con la fuente un proceso asistido por inteligencia artificial. No la ha revisado personal de salud. Es información ' +
      'general y no sustituye la consulta médica; ante signos de alarma, llama al **911**.'), t.slice(0, 200));
    for (const p of c.pasaje) assert.ok(t.includes(`«${p}»`), p);
    assert.ok(t.includes(`](${f.url})`));
    assert.match(t, /\(la lista no es completa\), llama al \*\*911\*\*/);
    assert.doesNotMatch(t, /revisad[ao] por|validad[ao]/i);
    const voz = textoHablado(t);
    assert.match(voz, /^Cita textual de /);
    assert.match(voz, /no la ha revisado personal de salud/);
    assert.match(voz, /\b911\b/);
    assert.ok(voz.includes(c.pasaje[c.pasaje.length - 1]), 'la voz lee la cita completa');
    assert.doesNotMatch(voz, /[>*_]/);
  } finally { c.auditoria = antes; }
});

test('sin ficha auditada, la respuesta clínica sigue siendo la del escalón 1', () => {
  const t = clinica.respuestaClinica('¿cómo se contagia la varicela?', 'varicela');
  assert.match(t, /consulta la fuente oficial/);
  assert.doesNotMatch(t, /Cita textual/);
});
