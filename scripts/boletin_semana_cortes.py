"""Corte observado de cada bloque estatal a partir del encabezado OCR de su cuadro.

Un encabezado declara un corte general y, a veces, cortes específicos:
«hasta la semana epidemiológica 41 del 2026; Cólera hasta la 42 del 2026». Cada bloque
toma el corte específico cuyo texto previo nombra al padecimiento (por palabras con
tolerancia a errores de OCR o por sus siglas, como ESAVI) y, si no, el corte general.
Un corte ausente o fuera de la semana del boletín y la anterior no se adivina.
"""
from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher

VACIAS = set('la el las los de del por y en o a al con sin otras otros otra otro hasta semana '
             'epidemiologica enfermedades enfermedad casos'.split())
CORTE = re.compile(r'(?:hasta\s+la\s+(?:semana\s+)?(?:epidemiologica\s+)?|semana\s+'
                   r'(?:epidemiologica\s+)?)(\d{1,2})(?:\s+del?\s+(20\d{2}))?')


def ascii_min(s: str) -> str:
    return unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()


def texto_corte(ocr: str) -> str:
    """Las dos primeras líneas del recorte OCR, sin la comilla espuria del margen."""
    return ' '.join(ocr.splitlines()[:2]).lstrip("‘'")


def _tokens(s: str) -> list:
    return [t for t in re.findall(r'[a-z]+', ascii_min(s)) if t not in VACIAS]


def _nombra(contexto: str, nombre: str) -> bool:
    ctx = [t for t in _tokens(contexto) if len(t) >= 3]
    nom = [t for t in _tokens(nombre) if len(t) >= 3]
    siglas = {''.join(t[0] for t in _tokens(nombre))}
    siglas |= {s.lower() for s in re.findall(r'\(([A-Z]{3,})\)', nombre)}
    if any(len(s) >= 3 and s in ctx for s in siglas):
        return True
    if not nom:
        return False
    hallados = sum(any(SequenceMatcher(None, t, c).ratio() >= .75 for c in ctx) for t in nom)
    return hallados >= min(2, len(nom))


def corte(ocr: str, nombre: str):
    """(semana, año o None) del bloque, o None si el encabezado no declara un corte."""
    t = re.sub(r'epidem\S*', 'epidemiologica', ascii_min(texto_corte(ocr)))
    t = t.replace('202o', '2020')
    hallados = list(CORTE.finditer(t))
    if not hallados:
        return None
    elegido = hallados[0]
    for previo, m in zip(hallados, hallados[1:]):
        if _nombra(t[previo.end():m.start()], nombre):
            elegido = m
    return int(elegido.group(1)), int(elegido.group(2)) if elegido.group(2) else None


def semanas_validas(anio: int, semana: int, semanas_anio_previo: int) -> set:
    """El cuadro observa la semana del boletín o la anterior, nunca otra."""
    if semana > 1:
        return {(anio, semana), (anio, semana - 1)}
    return {(anio, 1), (anio - 1, semanas_anio_previo)}
