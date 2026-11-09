"""Foto semanal vigente del radar del boletín, declarada en assets/boletin/actual.json.

Lo usan los scripts del histórico para no fijar una semana: el catálogo de identidades,
la semana del corte y el rezago de cada cuadro salen de la foto vigente.
"""
from __future__ import annotations

import json
from datetime import date, timedelta
from pathlib import Path


def carpeta(frontend: Path) -> Path:
    actual = json.loads((Path(frontend) / 'assets/boletin/actual.json').read_text())
    return Path(frontend) / actual['carpeta']


def catalogo(frontend: Path) -> dict:
    return json.loads((carpeta(frontend) / 'data.json').read_text())


def semanas_en(anio: int) -> int:
    def inicio(y):
        d = date(y, 1, 4)
        return d - timedelta(days=(d.weekday() + 1) % 7)
    return (inicio(anio + 1) - inicio(anio)).days // 7


def rezago(meta: dict, d: dict) -> int:
    """Semanas entre el boletín de la foto y el corte observado del cuadro de la categoría."""
    if d['id'].startswith('national-'):
        return 0
    semana, observada = meta['week'], d['observed_week']
    return semana - observada if observada <= semana else semana + semanas_en(meta['year'] - 1) - observada
