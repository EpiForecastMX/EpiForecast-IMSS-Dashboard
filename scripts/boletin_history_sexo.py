"""Acumulados por sexo del histórico de curvas del radar (assets/boletin/history/sexo/).

El boletín imprime, por entidad, el acumulado del año separado en hombres (H) y mujeres (M); el
histórico de curvas guarda sólo su suma. Este script relee, de cada punto publicado, el mismo PDF
(por sha256) y la misma página, separa H y M (en VIH, la suma de sus estadios por sexo) y escribe un
archivo por serie:

    {"schema": "boletin_history_sex.v1", "id": ..., "points": [{y, w, s, x: [H, M], e: [[H, M] x 32]}]}

Compuertas (cualquier fallo aborta sin escribir):
- Ninguna serie publicada cambia: el script sólo escribe en history/sexo/.
- H + M debe ser igual al acumulado publicado del punto, en el nacional y en cada entidad (el guion
  cuenta como 0 sólo para esta comprobación). Un acumulado publicado nulo deja nulo el sexo.
- El guion impreso se conserva como «-»: nunca se convierte en 0.

No resta acumulados ni produce casos semanales por sexo: el boletín no los publica.

Uso:
    python3 scripts/boletin_history_sexo.py --pdfs ../EpiForecast-MX/data/raw_PDFs ../planes \\
        --trabajo /ruta/temporal [--xml-cache /ruta/con/xml] [--procesos 6]
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import multiprocessing as mp
import os
import shutil
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
HIST = RAIZ / 'assets/boletin/history'
SCHEMA = 'boletin_history_sex.v1'


class Guion(int):
    """Un «-» impreso: vale 0 en la reconciliación del extractor, pero recuerda que era un guion."""

    def __new__(cls):
        return super().__new__(cls, 0)

    def __reduce__(self):
        return (Guion, ())


def _parchea_extractores() -> tuple:
    import boletin_archive_extract as archivo
    import boletin_history_extract as moderno

    if getattr(moderno, '_guion', False):
        return archivo, moderno
    val, number = moderno.val, archivo.number

    def es_guion(s: str) -> bool:
        t = s.replace(',', '').replace(' ', '').replace('−', '-').replace('–', '-')
        return bool(t) and set(t) <= set('-')

    def val_guion(s):
        return Guion() if es_guion(s) else val(s)

    def number_guion(s, source_hash=None, page=None):
        return Guion() if es_guion(s) else number(s, source_hash, page)

    moderno.val, archivo.number = val_guion, number_guion
    moderno._guion = True
    return archivo, moderno


def _extrae(args: tuple):
    i, src = args
    archivo, _ = _parchea_extractores()
    try:
        return i, archivo.extract(src), None
    except Exception as e:  # noqa: BLE001 - se informa por fuente
        return i, None, f'{type(e).__name__}: {e}'


def por_sexo(cols: list, vals: list):
    """[H, M] de una fila; None si el cuadro no separa sexo; 'NA' si falta alguna celda."""
    h = [v for c, v in zip(cols, vals) if c == 'H' or c.startswith('H_stage')]
    m = [v for c, v in zip(cols, vals) if c == 'M' or c.startswith('M_stage')]
    if not h or not m:
        return None
    if any(v is None for v in h + m):
        return 'NA'

    def junta(xs):
        return '-' if all(isinstance(v, Guion) for v in xs) else int(sum(xs))
    return [junta(h), junta(m)]


def numero(v) -> int | None:
    if v is None:
        return None
    return 0 if v == '-' else v


def suma(par) -> int:
    return sum(numero(v) for v in par)


def localiza(dirs: list, fuentes: list) -> dict:
    """Índice de fuente -> PDF local con el mismo sha256."""
    buscados = {s['sha256']: i for i, s in enumerate(fuentes)}
    nombres = {s['filename'] for s in fuentes}
    hallados = {}
    for d in dirs:
        for p in Path(d).rglob('*.pdf'):
            if p.name not in nombres and not p.name.lower().startswith('boletin-'):
                continue
            h = hashlib.sha256(p.read_bytes()).hexdigest()
            if h in buscados and buscados[h] not in hallados:
                hallados[buscados[h]] = str(p)
    return hallados


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--pdfs', nargs='+', required=True, help='Carpetas donde buscar los PDF por sha256')
    ap.add_argument('--trabajo', required=True, help='Carpeta temporal (caché nueva del extractor)')
    ap.add_argument('--xml-cache', help='Carpeta con XML de pdftotext ya generados (opcional)')
    ap.add_argument('--procesos', type=int, default=6)
    ap.add_argument('--salida', default=str(HIST / 'sexo'))
    a = ap.parse_args()

    trabajo = Path(a.trabajo).resolve()
    (trabajo / 'cache').mkdir(parents=True, exist_ok=True)
    if any((trabajo / 'cache').glob('*.json')):
        print('La carpeta de trabajo ya tiene una caché JSON: usa una nueva (la caché pierde los guiones).')
        return 1
    if a.xml_cache:
        for x in Path(a.xml_cache).glob('*.xml'):
            dst = trabajo / 'cache' / x.name
            if not dst.exists():
                os.symlink(x.resolve(), dst)
    os.environ['BOLETIN_WORK_DIR'] = str(trabajo)
    os.environ.setdefault('BOLETIN_FRONTEND', str(RAIZ))
    sys.path.insert(0, str(RAIZ / 'scripts'))
    os.chdir(RAIZ)

    index = json.loads((HIST / 'index.json').read_text())
    fuentes = index['sources']
    locales = localiza(a.pdfs, fuentes)
    faltan = [fuentes[i]['filename'] for i in range(len(fuentes)) if i not in locales]
    print(f'PDF locales: {len(locales)}/{len(fuentes)}; sin PDF local: {len(faltan)}')

    series = {k: json.loads((HIST / m['path'].rsplit('/', 1)[1]).read_text()) for k, m in index['series'].items()}
    puntos = collections.defaultdict(list)
    for sid, sh in series.items():
        for p in sh['points']:
            puntos[(p['s'], p['p'], sid)].append(p)
    dobles = [k for k, v in puntos.items() if len(v) > 1]
    if dobles:
        print('Puntos ambiguos por (fuente, página, id):', dobles[:5])
        return 1

    tareas = [(i, dict(fuentes[i], path=locales[i])) for i in sorted(locales)]
    with ProcessPoolExecutor(a.procesos, mp_context=mp.get_context('fork')) as pool:
        resultados = list(pool.map(_extrae, tareas, chunksize=4))

    sexo = collections.defaultdict(list)
    est = collections.Counter()
    problemas = []
    for i, r, err in resultados:
        if err:
            problemas.append(dict(fuente=fuentes[i]['filename'], error=err))
            continue
        for rec in r['records']:
            lst = puntos.get((i, rec['page'], rec['id']))
            if not lst:
                est['sin_punto'] += 1
                continue
            p = lst[0]
            x = por_sexo(rec['columns'], rec['totals'])
            if x is None:
                est['cuadro_sin_sexo'] += 1
                continue
            if x == 'NA' or p['n'][1] is None:
                x = None
            elif suma(x) != numero(p['n'][1]):
                problemas.append(dict(fuente=fuentes[i]['filename'], id=rec['id'], pagina=rec['page'],
                                      nacional=x, publicado=p['n'][1]))
                continue
            e = None
            if p.get('e') and rec['states']:
                if len(rec['states']) != len(p['e']):
                    problemas.append(dict(fuente=fuentes[i]['filename'], id=rec['id'], entidades=len(rec['states'])))
                    continue
                e = []
                for k, st in enumerate(rec['states']):
                    y = por_sexo(rec['columns'], st['values'])
                    c = p['e'][k][1]
                    if y in (None, 'NA') or c is None:
                        e.append(None)
                        continue
                    if suma(y) != numero(c):
                        problemas.append(dict(fuente=fuentes[i]['filename'], id=rec['id'], pagina=rec['page'],
                                              entidad=index['states'][k], sexo=y, publicado=c))
                    e.append(y)
            sexo[rec['id']].append(dict(y=p['y'], w=p['w'], s=p['s'], x=x, e=e))
            est['con_sexo'] += 1
    if problemas:
        print(f'ABORTA: {len(problemas)} problemas; no se escribe nada.')
        print(json.dumps(problemas[:20], ensure_ascii=False, indent=1))
        return 1

    salida = Path(a.salida)
    tmp = salida.with_name(salida.name + '.tmp')
    if tmp.exists():
        shutil.rmtree(tmp)
    tmp.mkdir(parents=True)
    manifiesto = {}
    for sid in sorted(sexo):
        pts = sorted(sexo[sid], key=lambda p: (p['y'], p['w'], p['s']))
        (tmp / f'{sid}.json').write_text(json.dumps(dict(schema=SCHEMA, id=sid, points=pts),
                                                    ensure_ascii=False, separators=(',', ':')) + '\n')
        con = [p for p in pts if p['x'] is not None]
        manifiesto[sid] = dict(path=f'/assets/boletin/history/sexo/{sid}.json', points=len(pts),
                               desde=f"{con[0]['y']}-W{con[0]['w']:02d}" if con else None,
                               hasta=f"{con[-1]['y']}-W{con[-1]['w']:02d}" if con else None)
    (tmp / 'index.json').write_text(json.dumps(dict(
        schema='boletin_history_sex_index.v1', checked=index['checked'], source_count=len(fuentes),
        sources_with_sex=len(locales), sources_without_local_pdf=faltan, series=manifiesto),
        ensure_ascii=False, separators=(',', ':')) + '\n')
    if salida.exists():
        shutil.rmtree(salida)
    tmp.rename(salida)
    print(dict(est), f'series con sexo: {len(manifiesto)}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
