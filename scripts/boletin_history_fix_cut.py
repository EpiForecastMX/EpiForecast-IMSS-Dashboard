"""Recoloca los puntos 2025–2026 de una categoría cuyo corte se leyó con el rezago equivocado.

Caso documentado: hipotermia (p57b1). El encabezado del cuadro 13.10 dice «hasta la
semana epidemiológica N−1; ESAVI hasta la semana N». La lectura OCR original no
reconoció «epidemtolégica» y tomó el corte de ESAVI para todo el cuadro, así que la
reconstrucción 2025–2026 situó cada punto una semana después de la observada (en 2024 y
antes, la reconstrucción del archivo sí usó N−1). Los dos boletines de la semana 1
quedaron además marcados como año contradictorio por ese mismo desfase.

Este script reconstruye esos puntos con la regla de boletin_history_build.py y el rezago
correcto, a partir de la extracción auditada 2025–2026 (extraction.json de
BOLETIN_WORK_DIR, comprimida o no), y comprueba que las cifras coinciden con las ya
publicadas antes de escribir. Uso:

    python3 scripts/boletin_history_fix_cut.py --id p57b1 --rezago 1 \\
        --extraccion <trabajo>/extraccion-auditada.json.gz
"""
from __future__ import annotations

import argparse
import gzip
import json
import sys
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import boletin_semana_historia as H  # noqa: E402


def periodo(y: int, w: int, rezago: int) -> tuple:
    d = H.inicio_anio(y) + timedelta(weeks=w - 1 - rezago)
    yy = d.year + 1
    while H.inicio_anio(yy) > d:
        yy -= 1
    return yy, (d - H.inicio_anio(yy)).days // 7 + 1


def acumulado(cols: list, v: list):
    vals = [v[k] for k, c in enumerate(cols)
            if c in ('H', 'M', 'cumulative') or c.startswith(('H_stage', 'M_stage'))]
    return sum(vals) if vals and all(x is not None for x in vals) else None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--id', required=True)
    ap.add_argument('--rezago', type=int, required=True)
    ap.add_argument('--extraccion', required=True)
    ap.add_argument('--raiz', default=str(Path(__file__).resolve().parents[1]))
    a = ap.parse_args()
    hist = Path(a.raiz) / H.DIR
    index, shards = H.cargar(hist)
    sh = shards[a.id]
    abrir = gzip.open if a.extraccion.endswith('.gz') else open
    with abrir(a.extraccion, 'rt') as f:
        raw = json.load(f)
    fuente = {(s['filename'], s['sha256']): i for i, s in enumerate(index['sources'])}
    nuevos, problemas = [], []
    for x in raw:
        src = x['source']
        si = fuente.get((src['filename'], src['sha256']))
        r = next((r for r in x['records'] if r['id'] == a.id), None)
        if r is None or src['year'] < 2025:
            continue
        if si is None:
            problemas.append(dict(fuente=src['filename'], tipo='fuente_desconocida'))
            continue
        y, w = periodo(src['year'], src['week'], a.rezago)
        cols, v = r['columns'], r['totals']
        flags = []
        if r['observed_year'] != y:
            flags.append('accumulated_year_conflict')
        if r['reconciled'] is False:
            flags.append('state_total_discrepancy')
        if any(z is not None and z < 0 for s in r['states'] for z in s['values']):
            flags.append('negative_values_reported')
        if any(z is None for z in v):
            flags.append('unavailable_source_cells')
        c = acumulado(cols, v)
        estados = {s['state']: s['values'] for s in r['states']}
        e = [[estados[n][0], None if flags and 'accumulated_year_conflict' in flags
              else acumulado(cols, estados[n])] for n in index['states']]
        p = dict(y=y, w=w, s=si, p=r['page'],
                 n=[v[0], None if 'accumulated_year_conflict' in flags else c],
                 prev=v[cols.index('previous')] if 'previous' in cols else None, e=e, flags=flags)
        if flags:
            p.update(reported_weekly=v[0], reported_year=r['observed_year'], reported_cumulative=c)
        viejo = next((q for q in sh['points'] if q['s'] == si), None)
        if viejo is None or viejo['n'][0] != p['n'][0] or viejo['prev'] != p['prev'] or \
                [z[0] for z in viejo['e']] != [z[0] for z in p['e']]:
            problemas.append(dict(fuente=src['filename'], tipo='cifras_distintas'))
        nuevos.append(p)
    if problemas or not nuevos:
        print('ERROR', json.dumps(problemas, ensure_ascii=False)[:2000], file=sys.stderr)
        return 1
    reemplazadas = {p['s'] for p in nuevos}
    sh['points'] = sorted([q for q in sh['points'] if q['s'] not in reemplazadas] + nuevos,
                          key=lambda q: (q['y'], q['w']))
    claves = [(q['y'], q['w']) for q in sh['points']]
    if len(claves) != len(set(claves)):
        print('ERROR: periodos repetidos tras recolocar', file=sys.stderr)
        return 1
    index['series'][a.id].update(H.contar(sh))
    (hist / f'{a.id}.json').write_text(H.compacto(sh), encoding='utf-8')
    (hist / 'index.json').write_text(H.compacto(index), encoding='utf-8')
    (hist / 'nacional-2013-2026.csv').write_bytes(H.csv_nacional(index, shards))
    print(f'{a.id}: {len(nuevos)} puntos recolocados con rezago {a.rezago}.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
