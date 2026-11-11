"""Celdas del boletín: cifra impresa o marcador no numérico, sin convertir uno en otro.

El boletín imprime cifras y símbolos. Su simbología (resumen nacional, páginas 9 y 10 en 2026)
dice: «( - ) : no se presentaron casos», «n.d. : información no disponible», «n.a. : no aplica»
y «s.n. : sin notificación por la entidad federativa». El radar guardaba el guion como 0 y
perdía el marcador. Ahora cada celda es un entero (la cifra impresa) o la cadena del símbolo
tal como se imprimió.

Para calcular (sumas, orden, puntaje), `numero` convierte con una regla explícita:

- una cifra es la cifra;
- un guion vale 0 sólo si la categoría sigue la simbología del boletín;
- un guion de una categoría con `guion.semantica == 'no_publicado'` no tiene valor (None): la
  propia fuente demuestra que en ese cuadro el guion no significa cero casos (sarampión y
  paludismo por P. falciparum, cuyas notas registran casos confirmados mientras el cuadro
  imprime guiones);
- n.d., n.a. y s.n. nunca tienen valor numérico.

Ninguna función rellena: lo que no tiene valor queda en None y quien suma lo trata como no
comparable.
"""
from __future__ import annotations

GUION = '-'
MARCADORES = (GUION, 'n.d.', 'n.a.', 's.n.')
NO_PUBLICADO = 'no_publicado'


def es_marcador(v) -> bool:
    return isinstance(v, str)


def guion_cuenta_como_cero(guion: dict | None) -> bool:
    return not guion or guion.get('semantica') != NO_PUBLICADO


def numero(v, guion: dict | None = None):
    """Valor para calcular, o None si la celda no tiene valor numérico comparable."""
    if v is None:
        return None
    if isinstance(v, bool):
        raise TypeError(v)
    if isinstance(v, (int, float)):
        return v
    if v == GUION and guion_cuenta_como_cero(guion):
        return 0
    return None


def suma(valores: list, guion: dict | None = None):
    """Suma de celdas de una misma fila.

    Todas con el mismo marcador: ese marcador (la suma de guiones se imprime como guion).
    Alguna sin valor comparable (n.d., s.n., guion no publicado junto a cifras): None.
    Si no, la suma de los valores (guion = 0 bajo la simbología).
    """
    if not valores:
        return None
    if all(es_marcador(v) for v in valores) and len(set(valores)) == 1:
        return valores[0]
    nums = [numero(v, guion) for v in valores]
    if any(n is None for n in nums):
        return None
    return sum(nums)


def reconcilia(celdas: list, total) -> bool:
    """¿La columna impresa cuadra con su TOTAL, comparando sólo lo comparable?

    La aritmética del cuadro no depende de la semántica: un guion no aporta cifra impresa.
    - TOTAL con cifra: la suma de las cifras impresas debe ser ese total, y ninguna celda
      puede ser n.d., n.a. ni s.n. (no se sabría qué contiene).
    - TOTAL con guion: todas las celdas deben ser guion o cero impreso.
    - TOTAL con otro marcador: no se puede comprobar; no reconcilia.
    """
    if es_marcador(total):
        return total == GUION and all(v == GUION or v == 0 for v in celdas)
    if any(es_marcador(v) and v != GUION for v in celdas):
        return False
    return sum(v for v in celdas if not es_marcador(v)) == total


def legado(v):
    """Representación anterior a la corrección (guion como 0, n.d. como None); sólo para
    comprobar que la corrección no cambió ninguna cifra."""
    if v == GUION:
        return 0
    if es_marcador(v):
        return None
    return v


CAMPOS_NACIONALES = ('weekly', 'cumulative', 'median', 'weekly_previous', 'previous')


def foto_legada(datos: dict) -> dict:
    """La foto en la representación anterior (guion = 0, sin simbología ni semántica del guion).

    Sirve para demostrar que la corrección sólo cambió la representación de los símbolos: la
    foto regenerada, pasada por aquí, debe ser byte a byte la publicada antes.
    """
    import copy
    d = copy.deepcopy(datos)
    d['meta'].pop('symbols', None)
    for x in d['diseases']:
        x.pop('guion', None)
        x['totals'] = [legado(v) for v in x['totals']]
        for s in x['states']:
            s['values'] = [legado(v) for v in s['values']]
        for k in ('weekly', 'cumulative', 'previous'):
            x[k] = legado(x[k])
        if x['score_parts'].get('carga') is None:
            x['score_parts']['carga'] = 0.0
    for n in d['national']:
        n.pop('guion', None)
        for k in CAMPOS_NACIONALES:
            n[k] = legado(n[k])
    return d
