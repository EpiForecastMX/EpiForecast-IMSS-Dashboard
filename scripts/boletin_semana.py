"""Genera la foto semanal del radar del boletín a partir del PDF oficial del SINAVE.

Uso típico, desde la raíz del repositorio del sitio:

    python3 scripts/boletin_semana.py --pdf ~/Descargas/Boletin-4326.pdf \\
        --url-fuente https://www.gob.mx/cms/uploads/attachment/file/NNNNNNN/Boletin-4326.pdf \\
        --publicacion 2026-11-09

Lee la foto vigente (assets/boletin/actual.json), extrae los 181 bloques estatales
con reconciliación exacta de sus 32 entidades, el resumen nacional y la tabla de
miasis; asigna a cada bloque su identidad estable (p70b1, ...) por nombre y código, y
hereda de la foto anterior los campos de cobertura (estado de publicación, plataforma,
notas, razones y prioridad), que nunca se recalculan desde cero. Escribe
assets/boletin/<año>-w<NN>/, activa esa foto en actual.json y en el texto estático de
boletin.html, y agrega la semana al histórico de curvas.

Falla cerrado (código 1, sin escribir nada) si un bloque no reconcilia, una celda es
ilegible, un corte no se puede leer o una identidad no se puede asignar.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import re
import shutil
import sys
import tempfile
import unicodedata
from collections import Counter
from datetime import date, timedelta
from difflib import SequenceMatcher
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import boletin_semana_activa as activa  # noqa: E402
import boletin_semana_cortes as cortes  # noqa: E402
import boletin_semana_extrae as extrae  # noqa: E402
import boletin_semana_historia as historia  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
MESES = extrae.MESES
CAMPOS_COBERTURA = ('aggregate', 'platform_id', 'status', 'source_note', 'reason')


class Fallo(Exception):
    def __init__(self, titulo: str, problemas: list):
        super().__init__(titulo)
        self.titulo, self.problemas = titulo, problemas


# Calendario epidemiológico (semanas de domingo a sábado) -------------------------------
def inicio_anio(y: int) -> date:
    d = date(y, 1, 4)
    return d - timedelta(days=(d.weekday() + 1) % 7)


def semanas_en(y: int) -> int:
    return (inicio_anio(y + 1) - inicio_anio(y)).days // 7


def fecha_larga(d: date) -> str:
    return f'{d.day} de {MESES[d.month - 1]} de {d.year}'


def periodo(y: int, w: int) -> str:
    a = inicio_anio(y) + timedelta(weeks=w - 1)
    b = a + timedelta(days=6)
    if a.year != b.year:
        return f'{fecha_larga(a)}–{fecha_larga(b)}'
    if a.month != b.month:
        return f'{a.day} de {MESES[a.month - 1]}–{fecha_larga(b)}'
    return f'{a.day}–{b.day} de {MESES[b.month - 1]} de {b.year}'


# Identidades estables -------------------------------------------------------------------
def norm(s: str) -> str:
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9]', '', s)


def asignar_identidades(bloques: list, previos: list) -> list:
    """Cada bloque nuevo recibe el id de la foto anterior por nombre y código impresos."""
    candidatos = [d for d in previos if d['states']]
    usados, problemas, ids = {}, [], []
    for b in bloques:
        nn, nc = norm(b['nombre']), norm(b['codigo'])
        pasos = [
            [d for d in candidatos if norm(d['name']) == nn and norm(d['code']) == nc],
            [d for d in candidatos if norm(d['name']) == nn],
        ]
        por_codigo = [d for d in candidatos if norm(d['code']) == nc]
        pasos.append([d for d in por_codigo
                      if SequenceMatcher(None, nn, norm(d['name'])).ratio() > .6])
        mejor = sorted(candidatos, key=lambda d: -SequenceMatcher(None, nn, norm(d['name'])).ratio())
        pasos.append([d for d in mejor[:1]
                      if SequenceMatcher(None, nn, norm(d['name'])).ratio() > .86])
        elegido = next((p[0] for p in pasos if len(p) == 1), None)
        if not elegido:
            problemas.append(dict(tipo='identidad_sin_asignar', pagina=b['page'],
                                  nombre=b['nombre'], codigo=b['codigo'],
                                  cercanos=[d['id'] for d in mejor[:3]]))
        elif elegido['id'] in usados:
            problemas.append(dict(tipo='identidad_duplicada', id=elegido['id'],
                                  paginas=[usados[elegido['id']], b['page']]))
        else:
            usados[elegido['id']] = b['page']
        ids.append(elegido['id'] if elegido else None)
    for d in candidatos:
        if d['id'] not in usados:
            problemas.append(dict(tipo='identidad_ausente', id=d['id'], nombre=d['name']))
    if problemas:
        raise Fallo('Identidades sin asignar de forma única', problemas)
    return ids


# Registro de cada categoría -------------------------------------------------------------
def variables(r: dict, anio: int, estadios: bool, rotulos: list) -> list:
    v = ['Año y semana de reporte', 'Casos semanales totales', f'Casos acumulados {anio}']
    if r['states']:
        v.append('Entidad federativa (32)')
    if 'H' in r['columns'] or estadios:
        v.append('Acumulados por sexo H/M')
    elif r['states']:
        v.append('Acumulado sin desglose H/M en el cuadro')
    if r['previous'] is not None:
        v.append(f'Acumulado comparable {anio - 1}')
    if estadios:
        v.append('Estadio clínico 1–4 por sexo')
    if not r['states']:
        v += [f'Mediana semanal {rotulos[2]}', f'Casos de la semana comparable {rotulos[3]}']
    return v


def puntaje(r: dict, maximo: int, afinidad) -> tuple:
    activas = sum(s['values'][0] > 0 for s in r['states'])
    crecimiento = (round(15 * min(1, max(0, (r['cumulative'] / r['previous'] - 1) / .5)), 2)
                   if r['previous'] else 0)
    return activas, {'carga': round(25 * math.log1p(r['cumulative']) / math.log1p(maximo), 2),
                     'afinidad': afinidad,
                     'dispersion': round(25 * activas / 32, 2),
                     'crecimiento': crecimiento}


def prioridad(r: dict, previo: dict):
    """Las categorías por incorporar se ordenan con la regla del radar; las demás heredan."""
    partes = r['score_parts']
    # Mismo orden de suma que la foto de la semana 42: el redondeo depende de él.
    total = round(partes['carga'] + partes['dispersion'] + partes['afinidad']
                  + partes['crecimiento'], 1)
    if previo['status'] != 'Por incorporar' or previo['aggregate']:
        return previo['priority'], (None if previo['score'] is None else total)
    if not r['states'] or r['cumulative'] < 1000:
        return 'Exploración', None
    return ('Alta' if total >= 75 else 'Media' if total >= 50 else 'Exploración'), total


def construir(ext: dict, previa: dict, ocr: dict, anio: int, semana: int) -> tuple:
    previos = {d['id']: d for d in previa['diseases']}
    ids = asignar_identidades(ext['estatales'], previa['diseases'])
    rotulos = [t.replace('-', '–') for t in ext['rotulos_nacionales']]
    validas = cortes.semanas_validas(anio, semana, semanas_en(anio - 1))
    problemas, avisos, registros = [], [], []
    for ident, b in zip(ids, ext['estatales']):
        r = dict(id=ident, name=b['nombre'], code=b['codigo'], page=b['page'],
                 group=previos[ident]['group'], columns=b['columns'], totals=b['totals'],
                 states=b['states'], reconciled=True, state_count=len(b['states']),
                 weekly=b['weekly'], cumulative=b['cumulative'], previous=b['previous'])
        texto = ext['titulos'].get(b['page']) or ocr.get(b['page'], '')
        c = cortes.corte(texto, b['nombre'])
        if c is None:
            problemas.append(dict(tipo='corte_ilegible', id=ident, pagina=b['page'], ocr=texto))
            continue
        sem, anio_c = c
        anio_corte = anio_c or (anio if (anio, sem) in validas else anio - 1)
        if (anio_corte, sem) not in validas:
            problemas.append(dict(tipo='corte_fuera_de_rango', id=ident, pagina=b['page'],
                                  corte=[anio_corte, sem], ocr=texto))
            continue
        if b['anio_observado'] != anio_corte:
            # Los acumulados serían de otro año que el corte: la reconstrucción los marca como
            # ambiguos; aquí no se publican sin revisión.
            problemas.append(dict(tipo='anio_de_acumulados_contradictorio', id=ident,
                                  pagina=b['page'], corte=[anio_corte, sem],
                                  anio_columnas=b['anio_observado']))
            continue
        r.update(observed_week=sem, cut_text=cortes.texto_corte(texto))
        r['_estadios'], r['_anio'] = b['estadios'], b['anio_observado']
        registros.append(r)
    nacional = ext['nacionales']
    for prev in previa['diseases']:
        if prev['states']:
            continue
        fila = [n for n in nacional if norm(n['code']) == norm(prev['code'])
                and norm(n['name'].lstrip('•')) == norm(prev['name'])]
        if len(fila) != 1:
            problemas.append(dict(tipo='identidad_nacional', id=prev['id'], nombre=prev['name'],
                                  coincidencias=len(fila)))
            continue
        n = fila[0]
        if n['weekly'] is None or n['cumulative'] is None:
            problemas.append(dict(tipo='nacional_sin_cifra', id=prev['id'], fila=n))
            continue
        registros.append(dict(
            id=prev['id'], name=n['name'].lstrip('•'), code=n['code'], page=n['page'],
            group=prev['group'],
            columns=['Sem.', f'Acum. {rotulos[1]}', f'Mediana {rotulos[2]}', f'Sem. {rotulos[3]}',
                     f'Acum. {rotulos[4]}'],
            totals=[n['weekly'], n['cumulative'], n['median'], n['weekly_previous'], n['previous']],
            weekly=n['weekly'], cumulative=n['cumulative'], previous=n['previous'], states=[],
            state_count=0, reconciled=None, observed_week=semana,
            cut_text=f'Resumen de notificación inmediata y semanal del boletín {semana}/{anio}',
            _estadios=False, _anio=anio))
    if problemas:
        raise Fallo('Cortes o identidades nacionales sin resolver', problemas)
    maximo = max(r['cumulative'] for r in registros)
    salida = []
    for r in registros:
        p = previos[r['id']]
        for campo in CAMPOS_COBERTURA:
            r[campo] = p[campo]
        r['variables'] = variables(r, r['_anio'], r['_estadios'], rotulos)
        r['active_states'], r['score_parts'] = puntaje(r, maximo, p['score_parts']['afinidad'])
        r['priority'], r['score'] = prioridad(r, p)
        # Las notas heredadas citan páginas; si el bloque cambió de página, hay que revisarlas.
        citadas = [int(m) for m in re.findall(r'página (\d+)', r['source_note'])]
        vigentes = {r['page'], *(n['page'] for n in nacional)}
        if any(c not in vigentes for c in citadas):
            avisos.append(dict(tipo='nota_con_pagina', id=r['id'], pagina=r['page'],
                               citadas=citadas, nota=r['source_note']))
        orden = ['id', 'name', 'code', 'page', 'group', 'columns', 'totals']
        orden += (['states', 'reconciled', 'state_count', 'weekly', 'cumulative', 'previous']
                  if r['states'] else
                  ['weekly', 'cumulative', 'previous', 'states', 'state_count', 'reconciled'])
        orden += ['aggregate', 'platform_id', 'status', 'source_note', 'observed_week', 'cut_text',
                  'variables', 'active_states', 'score_parts', 'score', 'reason', 'priority']
        salida.append({k: r[k] for k in orden})
    return salida, avisos


# Escritura ------------------------------------------------------------------------------
def leer_semana(texto: str) -> tuple:
    hallados = Counter(re.findall(r'Semana (\d{1,2}), (20\d\d)', texto))
    if not hallados:
        raise Fallo('El PDF no declara su semana', [dict(tipo='membrete')])
    (w, y), _ = hallados.most_common(1)[0]
    volumen = re.search(r'Volumen (\d+)', texto)
    return int(y), int(w), int(volumen.group(1)) if volumen else None


def generar(args) -> dict:
    pdf = Path(args.pdf).resolve()
    previa_dir = Path(args.anterior)
    previa = json.loads((previa_dir / 'data.json').read_text())
    texto = extrae.texto_layout(pdf)
    anio, semana, volumen = leer_semana(texto.decode('utf-8', 'replace'))
    if args.semana and (args.anio, args.semana) != (anio, semana):
        raise Fallo('La semana indicada no coincide con el PDF',
                    [dict(indicada=[args.anio, args.semana], pdf=[anio, semana])])
    try:
        ext = extrae.leer(pdf, anio, texto)
    except extrae.ErrorExtraccion as e:
        raise Fallo('El PDF no se pudo leer sin ambigüedad', e.problemas) from e
    # El título del cuadro se lee del texto del PDF; sólo si es imagen se recurre al OCR.
    ocr = extrae.ocr_encabezados(pdf, [pn for pn in ext['paginas_estatales']
                                       if not ext['titulos'].get(pn)])
    enfermedades, avisos = construir(ext, previa, ocr, anio, semana)
    nacional = ext['nacionales']
    for n in nacional:
        if not n['code']:
            raise Fallo('Fila nacional sin código', [n])
    sha = hashlib.sha256(pdf.read_bytes()).hexdigest()
    bloques = sum(1 for d in enfermedades if d['states'])
    agregados = sum(1 for d in enfermedades if d['aggregate'])
    plataforma = len({d['platform_id'] for d in enfermedades if d['platform_id']})
    comprobado = date.fromisoformat(args.comprobado) if args.comprobado else date.today()
    meta = dict(week=semana, year=anio, period=periodo(anio, semana),
                publication=fecha_larga(date.fromisoformat(args.publicacion)),
                checked=fecha_larga(comprobado), source_url=args.url_fuente,
                index_url=previa['meta']['index_url'], pdf_sha256=sha,
                territorial_blocks=bloques, national_rows=len(nacional),
                categories=len(enfermedades) - agregados, aggregate_rows=agregados,
                platform_published=plataforma,
                reconciliation=f'{bloques}/{bloques} bloques; 32 entidades por bloque; '
                               'tolerancia cero',
                registry_sha256=(hashlib.sha256(Path(args.registro).read_bytes()).hexdigest()
                                 if args.registro else previa['meta']['registry_sha256']))
    datos = dict(meta=meta, diseases=enfermedades, national=nacional, myiasis=ext['miasis'])
    verificacion = dict(schema='boletin_radar.v1', source_pdf_sha256=sha,
                        source_period=f'{anio}-W{semana:02d}', checked=comprobado.isoformat(),
                        state_blocks=bloques, states_per_block=32, state_columns_reconciled=True,
                        national_rows=len(nacional), national_values_verified=5 * len(nacional),
                        categories_excluding_aggregate=meta['categories'],
                        published_platform_entries=plataforma,
                        scope='Fixed snapshot of notified cases and incorporation proposal; no '
                              'new forecast models.')
    if avisos:
        verificacion['warnings'] = avisos
    nombre_pdf = Path(args.url_fuente.split('?')[0]).name.lower()
    return dict(datos=datos, verificacion=verificacion, texto=texto, ocr=ocr, pdf=pdf,
                nombre_pdf=nombre_pdf, anio=anio, semana=semana, volumen=volumen, avisos=avisos)


def escribir(res: dict, destino: Path) -> None:
    destino.mkdir(parents=True)
    d = res['datos']
    (destino / 'data.json').write_text(json.dumps(d, ensure_ascii=False, separators=(',', ':')),
                                       encoding='utf-8')
    with (destino / 'catalogo.csv').open('w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f, lineterminator='\n')
        w.writerow(['categoria', 'CIE_impreso', 'grupo', 'pagina', f'semana_{res["anio"]}',
                    f'acumulado_{res["anio"]}', f'acumulado_{res["anio"] - 1}',
                    'estado_plataforma', 'prioridad', 'puntaje'])
        for x in d['diseases']:
            w.writerow([x['name'], x['code'], x['group'], x['page'], x['weekly'], x['cumulative'],
                        x['previous'], x['status'], x['priority'], x['score']])
    (destino / 'verification.json').write_text(
        json.dumps(res['verificacion'], ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    (destino / 'boletin.txt').write_bytes(res['texto'])
    ocr = {str(k): v for k, v in sorted(res['ocr'].items())}
    (destino / 'encabezados-ocr.json').write_text(json.dumps(ocr, ensure_ascii=False, indent=2),
                                                  encoding='utf-8')
    shutil.copyfile(res['pdf'], destino / res['nombre_pdf'])


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--pdf', required=True, help='PDF oficial del boletín')
    p.add_argument('--url-fuente', required=True, help='URL oficial del PDF en gob.mx')
    p.add_argument('--publicacion', required=True, help='fecha de publicación, AAAA-MM-DD')
    p.add_argument('--comprobado', help='fecha de comprobación, AAAA-MM-DD (hoy por omisión)')
    p.add_argument('--anterior', help='foto anterior (por omisión, la de actual.json)')
    p.add_argument('--salida', help='carpeta de la foto nueva (por omisión assets/boletin/'
                                    '<año>-w<NN>)')
    p.add_argument('--anio', type=int, help='año esperado; se comprueba contra el PDF')
    p.add_argument('--semana', type=int, help='semana esperada; se comprueba contra el PDF')
    p.add_argument('--registro', help='config/padecimientos.yaml del backend, si cambió')
    p.add_argument('--raiz', default=str(RAIZ), help='raíz del sitio')
    p.add_argument('--reemplazar', action='store_true', help='sobrescribe una foto existente')
    p.add_argument('--sin-activar', action='store_true',
                   help='no toca actual.json ni boletin.html')
    p.add_argument('--sin-historia', action='store_true', help='no agrega la semana al histórico')
    args = p.parse_args(argv)
    raiz = Path(args.raiz)
    actual = raiz / 'assets/boletin/actual.json'
    if not args.anterior:
        args.anterior = str(raiz / json.loads(actual.read_text())['carpeta'])
    try:
        res = generar(args)
    except Fallo as e:
        print(f'ERROR: {e.titulo}', file=sys.stderr)
        for prob in e.problemas:
            print('  ' + json.dumps(prob, ensure_ascii=False)[:600], file=sys.stderr)
        return 1
    carpeta = f'assets/boletin/{res["anio"]}-w{res["semana"]:02d}'
    destino = (Path(args.salida) if args.salida else raiz / carpeta).resolve()
    if destino.exists() and not args.reemplazar:
        print(f'ERROR: {destino} ya existe; usa --reemplazar para regenerarla', file=sys.stderr)
        return 1
    try:
        carpeta = destino.relative_to(raiz.resolve()).as_posix()
    except ValueError:
        if not (args.sin_activar and args.sin_historia):
            print('ERROR: una salida fuera del sitio exige --sin-activar y --sin-historia',
                  file=sys.stderr)
            return 1
    plan = None
    if not args.sin_historia:
        # El histórico se prepara en memoria antes de escribir nada: si falla, no cambia nada.
        try:
            plan = historia.preparar(raiz, res['datos'], args.url_fuente,
                                     res['datos']['meta']['pdf_sha256'],
                                     res['verificacion']['checked'])
        except historia.FalloHistoria as e:
            print(f'ERROR: {e.titulo}', file=sys.stderr)
            for prob in e.problemas:
                print('  ' + json.dumps(prob, ensure_ascii=False)[:600], file=sys.stderr)
            return 1
    destino.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='boletin-semana-', dir=destino.parent) as tmp:
        temporal = Path(tmp) / 'foto'
        escribir(res, temporal)
        if destino.exists():
            shutil.rmtree(destino)
        temporal.rename(destino)
    for aviso in res['avisos']:
        print('AVISO: ' + json.dumps(aviso, ensure_ascii=False), file=sys.stderr)
    m = res['datos']['meta']
    print(f'Foto {destino}: {m["territorial_blocks"]} bloques reconciliados, '
          f'{m["national_rows"]} filas nacionales, {m["categories"]} categorías, '
          f'{m["platform_published"]} publicadas.')
    if plan:
        historia.aplicar(plan)
        print(f'Histórico: {plan["puntos"]} puntos agregados en assets/boletin/history/.')
        for r in plan['revisadas']:
            print('AVISO: periodo ya observado; la edición nueva gobierna y la anterior queda '
                  'como revisión: ' + json.dumps(r, ensure_ascii=False), file=sys.stderr)
    if not args.sin_activar:
        activa.activar(raiz, carpeta, res['nombre_pdf'], res['volumen'])
        print('Activada en assets/boletin/actual.json y boletin.html.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
