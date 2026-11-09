"""Agrega un boletín semanal al histórico de curvas sin reconstruirlo desde 2013.

Produce, para la foto semanal recién generada, los mismos puntos que la reconstrucción
completa (boletin_history_build.py seguido de boletin_archive_build.py): un punto por
categoría en su semana observada, con las 32 entidades, y la misma regla de revisiones
(si un periodo ya tenía punto, gobierna el boletín más reciente y el anterior pasa a
«revisions»). Reescribe index.json, los fragmentos tocados y nacional-2013-2026.csv.

Todo se calcula en memoria y sólo se escribe si no hay problemas.
"""
from __future__ import annotations

import csv
import io
import json
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from boletin_semana_extrae import acumulados  # noqa: E402

DIR = 'assets/boletin/history'


class FalloHistoria(Exception):
    def __init__(self, titulo: str, problemas: list):
        super().__init__(titulo)
        self.titulo, self.problemas = titulo, problemas


def inicio_anio(y: int) -> date:
    d = date(y, 1, 4)
    return d - timedelta(days=(d.weekday() + 1) % 7)


def compacto(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, separators=(',', ':')) + '\n'


def cargar(hist: Path) -> tuple:
    index = json.loads((hist / 'index.json').read_text())
    shards = {k: json.loads((hist / m['path'].rsplit('/', 1)[1]).read_text())
              for k, m in index['series'].items()}
    return index, shards


def punto(d: dict, anio: int, semana: int, si: int, estados: list) -> tuple:
    """(año observado, semana observada) y el punto en el formato del histórico."""
    obs = d['observed_week']
    y = anio if obs <= semana else anio - 1
    flags = []
    e = None
    if d['states']:
        filas = {s['state']: s['values'] for s in d['states']}
        if set(filas) != set(estados):
            raise FalloHistoria('Entidades distintas del histórico',
                                [dict(id=d['id'], faltan=sorted(set(estados) - set(filas)))])
        e = [[filas[n][0], acumulados(d['columns'], filas[n], y)] for n in estados]
        if any(v < 0 for vals in filas.values() for v in vals):
            flags.append('negative_values_reported')
    if any(v is None for v in d['totals']):
        flags.append('unavailable_source_cells')
    p = dict(y=y, w=obs, s=si, p=d['page'], n=[d['weekly'], d['cumulative']],
             prev=d['previous'], e=e, flags=flags)
    if flags:
        p.update(reported_weekly=d['weekly'], reported_year=y, reported_cumulative=d['cumulative'])
    return (y, obs), p


def contar(shard: dict) -> dict:
    ps = shard['points']
    return dict(points=len(ps), state_points=sum(p['e'] is not None for p in ps),
                flagged_points=sum(bool(p['flags']) for p in ps),
                revisions=len(shard['revisions']), unplaced=len(shard['unplaced']))


def csv_nacional(index: dict, shards: dict) -> bytes:
    """Mismo CSV que boletin_archive_build.py: puntos, revisiones y fuera de lugar."""
    fuentes = index['sources']
    nombres = {c['id']: c for c in index['categories']}
    out = io.StringIO()
    out.write('﻿')
    w = csv.writer(out, lineterminator='\n')
    w.writerow(['padecimiento', 'CIE_corte_actual_o_historico', 'anio_observado',
                'semana_observada', 'casos_semanales', 'acumulado_observado',
                'en_estudio_acumulados', 'boletin_anio', 'boletin_semana', 'pagina', 'fuente',
                'PDF_archivo', 'avisos', 'revision_sustituida', 'fecha_ambigua',
                'semanal_impreso_no_graficado', 'acumulado_impreso_no_graficado'])
    for ident in index['series']:
        sh, d = shards[ident], nombres[ident]
        for vieja, puntos in ((False, sh['points']), (True, sh['revisions']),
                              (False, sh['unplaced'])):
            for p in puntos:
                s = fuentes[p['s']]
                corte = 'reported_cut' in p
                w.writerow([d['name'], d['code'], p['y'], p['w'], *p['n'], p.get('in_study'),
                            s['year'], s['week'], p['p'], s['url'], s.get('archive_member', ''),
                            '|'.join(p['flags']), int(vieja), int(corte),
                            p.get('reported_weekly') if corte else None,
                            p.get('reported_cumulative') if corte else None])
    return out.getvalue().encode('utf-8')


def incorporar(index: dict, shards: dict, datos: dict, url: str, sha: str,
               comprobado: str) -> list:
    """Modifica index y shards en memoria; devuelve las identidades con revisión nueva."""
    meta = datos['meta']
    anio, semana = meta['year'], meta['week']
    fuentes = index['sources']
    if any(s['sha256'] == sha for s in fuentes):
        raise FalloHistoria('El PDF ya está en el histórico', [dict(sha256=sha)])
    ultimo = max((s['year'], s['week']) for s in fuentes)
    if (anio, semana) <= ultimo:
        raise FalloHistoria('El histórico ya llega a esa semana o a una posterior',
                            [dict(ultimo=list(ultimo), nuevo=[anio, semana])])
    faltan = [d['id'] for d in datos['diseases'] if d['id'] not in index['series']]
    if faltan:
        raise FalloHistoria('Identidades sin serie histórica', [dict(ids=faltan)])
    si = len(fuentes)
    fuentes.append(dict(year=anio, week=semana, url=url, filename=f'{anio}_sem{semana:02d}.pdf',
                        sha256=sha))
    index['source_count'] = len(fuentes)
    index['source_years'][str(anio)] = index['source_years'].get(str(anio), 0) + 1
    if not any(p['y'] == anio and p['w'] == semana for p in index['periods']):
        index['periods'].append(dict(y=anio, w=semana,
                                     start=(inicio_anio(anio) + timedelta(weeks=semana - 1))
                                     .isoformat()))
    index['checked'] = comprobado
    revisadas = []
    for d in datos['diseases']:
        clave, p = punto(d, anio, semana, si, index['states'])
        sh = shards[d['id']]
        previo = next((q for q in sh['points'] if (q['y'], q['w']) == clave), None)
        if previo:
            # Igual que la reconstrucción completa: gobierna la edición más reciente.
            versiones = [q for q in sh['revisions'] if (q['y'], q['w']) == clave]
            previo.pop('revisions', None)
            sh['points'].remove(previo)
            sh['revisions'].append(previo)
            sh['revisions'].sort(key=lambda q: (q['y'], q['w'], q['s']))
            p['revisions'] = len(versiones) + 1
            revisadas.append(dict(id=d['id'], periodo=list(clave)))
        sh['points'].append(p)
        sh['points'].sort(key=lambda q: (q['y'], q['w']))
        index['series'][d['id']].update(contar(sh))
    return revisadas


def preparar(raiz: Path, datos: dict, url: str, sha: str, comprobado: str) -> dict:
    """Plan de escritura {ruta: bytes}; lanza FalloHistoria si algo no cuadra."""
    hist = raiz / DIR
    index, shards = cargar(hist)
    antes = {k: compacto(v) for k, v in shards.items()}
    revisadas = incorporar(index, shards, datos, url, sha, comprobado)
    plan = {hist / 'index.json': compacto(index).encode('utf-8'),
            hist / 'nacional-2013-2026.csv': csv_nacional(index, shards)}
    for k, sh in shards.items():
        texto = compacto(sh)
        if texto != antes[k]:
            plan[hist / index['series'][k]['path'].rsplit('/', 1)[1]] = texto.encode('utf-8')
    return dict(plan=plan, revisadas=revisadas, puntos=len(datos['diseases']))


def aplicar(plan: dict) -> None:
    for ruta, contenido in plan['plan'].items():
        tmp = ruta.with_suffix(ruta.suffix + '.tmp')
        tmp.write_bytes(contenido)
        tmp.replace(ruta)


def retirar_ultima(index: dict, shards: dict) -> None:
    """Deshace la última fuente agregada (para pruebas de regresión y para revertir)."""
    si = len(index['sources']) - 1
    s = index['sources'].pop()
    index['source_count'] = len(index['sources'])
    index['source_years'][str(s['year'])] -= 1
    if not index['source_years'][str(s['year'])]:
        del index['source_years'][str(s['year'])]
    if not any(f['year'] == s['year'] and f['week'] == s['week'] for f in index['sources']):
        index['periods'] = [p for p in index['periods']
                            if (p['y'], p['w']) != (s['year'], s['week'])]
    for k, sh in shards.items():
        nuevos = [p for p in sh['points'] if p['s'] == si]
        if not nuevos and not any(p['s'] == si for p in sh['revisions'] + sh['unplaced']):
            continue
        sh['unplaced'] = [p for p in sh['unplaced'] if p['s'] != si]
        sh['revisions'] = [p for p in sh['revisions'] if p['s'] != si]
        for p in nuevos:
            sh['points'].remove(p)
            if p.get('revisions'):
                vieja = max((q for q in sh['revisions'] if (q['y'], q['w']) == (p['y'], p['w'])),
                            key=lambda q: q['s'])
                sh['revisions'].remove(vieja)
                if p['revisions'] > 1:
                    vieja['revisions'] = p['revisions'] - 1
                sh['points'].append(vieja)
        sh['points'].sort(key=lambda q: (q['y'], q['w']))
        index['series'][k].update(contar(sh))
