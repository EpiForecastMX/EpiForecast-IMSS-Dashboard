"""Esquema, validación aritmética/estructural y proyección pública cerrada de miasis."""
from __future__ import annotations

import copy
import json
import math
import re
from datetime import date

SCHEMA = 'boletin_discrepancias_fuente.v1'
COLUMNAS_CONTEO_MIASIS = (0, 2, 3, 5, 6, 7, 9)
SHA256_RE = re.compile(r'^[0-9a-f]{64}$')
PLACEHOLDER_RE = re.compile(r'^<.*>$')

CLAVES_REGISTRO = frozenset({
    'pdf_sha256', 'pagina', 'cuadro', 'columna', 'nombre_columna',
    'suma_estados', 'total_impreso', 'delta', 'filas_con_identidad_rota',
    'estado', 'celdas_modificadas', 'decision',
})
CLAVES_DECISION = frozenset({
    'autor', 'fecha', 'texto_literal', 'enlace_evidencia', 'evidencia_sha256',
})
CLAVES_DECISION_OPC = frozenset({'solo_pruebas'})
CAMPOS_TECNICOS_PUBLICOS = (
    'pdf_sha256', 'pagina', 'cuadro', 'columna', 'nombre_columna',
    'suma_estados', 'total_impreso', 'delta', 'filas_con_identidad_rota',
    'estado', 'celdas_modificadas',
)
CLAVES_PROYECCION_PUBLICA = (*CAMPOS_TECNICOS_PUBLICOS, 'authorization_sha256', 'disposition_file_sha256')
CLAVES_PRIVADAS_PROHIBIDAS = frozenset({
    'decision', 'autor', 'fecha', 'texto_literal', 'enlace_evidencia', 'evidencia_sha256', 'solo_pruebas',
})


class ErrorDisposicion(ValueError):
    """Error de validación de una disposición nominal; transporta el problema estructurado."""

    def __init__(self, tipo: str, **campos):
        self.problema = {'tipo': tipo, **campos}
        super().__init__(json.dumps(self.problema, ensure_ascii=False))


def es_entero(v) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


def conteo_entero(v) -> int:
    if isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or not float(v).is_integer():
        raise ErrorDisposicion('miasis_conteo_no_entero', valor=v)
    return int(v)


def texto_real(v) -> bool:
    return isinstance(v, str) and bool(v.strip()) and not PLACEHOLDER_RE.match(v.strip())


def filas_identidad_rota_miasis(filas: list, columna: int) -> list[dict]:
    """Filas cuya identidad horizontal de conteos enteros falla para la familia de `columna`."""
    cols = (0, 3, 7) if columna in (0, 3, 7) else (2, 5, 9) if columna in (2, 5, 9) else None
    if cols is None:
        return []
    ka, kb, kt = f'col{cols[0]}', f'col{cols[1]}', f'col{cols[2]}_impreso'
    out = []
    for f in filas:
        a, b, tot = (conteo_entero(f['values'][i]) for i in cols)
        if a + b != tot:
            out.append({'estado': f['state'], ka: a, kb: b, kt: tot})
    return out


def construir_problema_miasis(pn: int, columna: int, nombre_columna: str,
                              filas: list, totales: list) -> dict | None:
    """Devuelve el problema detallado si la columna `columna` no cuadra verticalmente con `totales`."""
    suma_col = sum(conteo_entero(f['values'][columna]) for f in filas)
    total_col = conteo_entero(totales[columna])
    rotas = filas_identidad_rota_miasis(filas, columna)
    if suma_col == total_col:
        return None
    return {
        'pagina': pn, 'tipo': 'miasis_reconciliacion', 'cuadro': 'miasis',
        'columna': columna, 'nombre_columna': nombre_columna,
        'suma_estados': suma_col, 'total_impreso': total_col,
        'delta': total_col - suma_col, 'filas_con_identidad_rota': rotas,
    }


def problemas_horizontales_sin_discrepancia_vertical(
    pn: int, columnas: list[str], filas: list, columnas_verticales_rotas: set[int],
) -> list[dict]:
    """Detecta identidades horizontales rotas aunque todas las columnas de la familia sumen su total."""
    out = []
    for familia, col_total in (((0, 3, 7), 7), ((2, 5, 9), 9)):
        if any(c in columnas_verticales_rotas for c in familia):
            continue
        rotas = filas_identidad_rota_miasis(filas, col_total)
        if rotas:
            out.append({
                'pagina': pn, 'tipo': 'miasis_identidad_horizontal_rota', 'cuadro': 'miasis',
                'columna': col_total, 'nombre_columna': columnas[col_total],
                'filas_con_identidad_rota': rotas,
            })
    return out


def canonicalizar_filas_rotas(filas_rotas, columna: int) -> list[dict]:
    if not isinstance(filas_rotas, list):
        raise ErrorDisposicion('disposicion_filas_invalidas', detalle='debe ser lista')
    claves = (('estado', 'col0', 'col3', 'col7_impreso') if columna in (0, 3, 7)
              else ('estado', 'col2', 'col5', 'col9_impreso') if columna in (2, 5, 9)
              else None)
    if claves is None:
        if filas_rotas:
            raise ErrorDisposicion('disposicion_filas_invalidas', columna=columna)
        return []
    _, ka, kb, kt = claves
    canon = []
    for item in filas_rotas:
        if not isinstance(item, dict) or set(item.keys()) != set(claves) or not texto_real(item['estado']):
            raise ErrorDisposicion('disposicion_filas_invalidas', item=item)
        if not all(es_entero(item[k]) for k in (ka, kb, kt)) or item[ka] + item[kb] == item[kt]:
            raise ErrorDisposicion('disposicion_filas_invalidas', item=item)
        canon.append({k: item[k] for k in claves})
    return canon


def validar_decision(dec) -> bool:
    if not isinstance(dec, dict):
        raise ErrorDisposicion('disposicion_decision_invalida', detalle='decision no es objeto')
    claves = set(dec.keys())
    if not CLAVES_DECISION.issubset(claves) or not claves.issubset(CLAVES_DECISION | CLAVES_DECISION_OPC):
        raise ErrorDisposicion('disposicion_decision_invalida', claves=sorted(claves))
    for campo in ('autor', 'texto_literal', 'enlace_evidencia'):
        if not texto_real(dec[campo]):
            raise ErrorDisposicion('disposicion_decision_invalida', campo=campo)
    if not isinstance(dec['fecha'], str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', dec['fecha']):
        raise ErrorDisposicion('disposicion_decision_invalida', campo='fecha')
    try:
        date.fromisoformat(dec['fecha'])
    except ValueError as e:
        raise ErrorDisposicion('disposicion_decision_invalida', campo='fecha', detalle=str(e)) from e
    if not isinstance(dec['evidencia_sha256'], str) or not SHA256_RE.match(dec['evidencia_sha256']):
        raise ErrorDisposicion('disposicion_decision_invalida', campo='evidencia_sha256')
    if 'solo_pruebas' in dec and not isinstance(dec['solo_pruebas'], bool):
        raise ErrorDisposicion('disposicion_decision_invalida', campo='solo_pruebas')
    return (bool(dec.get('solo_pruebas'))
            or 'TEST_ONLY' in dec['autor'].upper()
            or 'TEST_ONLY' in dec['texto_literal'].upper()
            or 'TEST_ONLY' in dec['enlace_evidencia'].upper())


def validar_registro(r, pdf_sha256: str) -> tuple[dict, bool]:
    if not isinstance(r, dict):
        raise ErrorDisposicion('disposicion_esquema_invalido', detalle='registro no es objeto')
    if r.get('cuadro') != 'miasis':
        raise ErrorDisposicion(
            'disposicion_ambito_prohibido', cuadro=r.get('cuadro'),
            detalle='sólo el cuadro complementario de miasis admite disposición nominal',
        )
    if set(r.keys()) != CLAVES_REGISTRO:
        raise ErrorDisposicion(
            'disposicion_esquema_invalido',
            faltan=sorted(CLAVES_REGISTRO - set(r.keys())),
            sobran=sorted(set(r.keys()) - CLAVES_REGISTRO),
        )
    if not isinstance(r['pdf_sha256'], str) or not SHA256_RE.match(r['pdf_sha256']):
        raise ErrorDisposicion('disposicion_sha256_invalido', pdf_sha256=r.get('pdf_sha256'))
    if r['pdf_sha256'] != pdf_sha256:
        raise ErrorDisposicion('disposicion_sha256_distinto', esperado=pdf_sha256, declarado=r['pdf_sha256'])
    if not es_entero(r['pagina']) or r['pagina'] < 1:
        raise ErrorDisposicion('disposicion_pagina_invalida', pagina=r['pagina'])
    if not es_entero(r['columna']) or r['columna'] not in COLUMNAS_CONTEO_MIASIS:
        raise ErrorDisposicion('disposicion_columna_invalida', columna=r['columna'])
    if not texto_real(r['nombre_columna']):
        raise ErrorDisposicion('disposicion_columna_invalida', nombre_columna=r['nombre_columna'])
    if not all(es_entero(r[k]) for k in ('suma_estados', 'total_impreso', 'delta')):
        raise ErrorDisposicion('disposicion_cifras_invalidas')
    if r['delta'] == 0 or r['total_impreso'] - r['suma_estados'] != r['delta']:
        raise ErrorDisposicion('disposicion_delta_inconsistente', delta=r['delta'])
    if r['estado'] != 'NO_RECONCILIADO':
        raise ErrorDisposicion('disposicion_estado_prohibido', estado=r['estado'])
    if not es_entero(r['celdas_modificadas']) or r['celdas_modificadas'] != 0:
        raise ErrorDisposicion('disposicion_celdas_modificadas_prohibido', celdas_modificadas=r['celdas_modificadas'])
    filas_canon = canonicalizar_filas_rotas(r['filas_con_identidad_rota'], r['columna'])
    solo_pruebas = validar_decision(r['decision'])
    copia = copy.deepcopy(r)
    copia['filas_con_identidad_rota'] = filas_canon
    return copia, solo_pruebas


def proyectar_discrepancia_publica(r: dict, disposition_file_sha256: str) -> dict:
    """Proyecta 13 claves cerradas (técnicas + SHA-256 calculado del archivo + SHA-256 declarado del acta)."""
    if not isinstance(r, dict):
        raise ErrorDisposicion('disposicion_esquema_invalido', detalle='registro no es objeto')
    if not isinstance(disposition_file_sha256, str) or not SHA256_RE.match(disposition_file_sha256):
        raise ErrorDisposicion('disposicion_sha256_invalido', disposition_file_sha256=disposition_file_sha256)
    dec = r.get('decision')
    auth_sha = dec.get('evidencia_sha256') if isinstance(dec, dict) else None
    if not isinstance(auth_sha, str) or not SHA256_RE.match(auth_sha):
        raise ErrorDisposicion('disposicion_decision_invalida', campo='evidencia_sha256')
    if not all(k in r for k in CAMPOS_TECNICOS_PUBLICOS):
        raise ErrorDisposicion('disposicion_esquema_invalido', detalle='faltan campos técnicos')
    if not es_entero(r['columna']) or r['columna'] not in COLUMNAS_CONTEO_MIASIS:
        raise ErrorDisposicion('disposicion_columna_invalida', columna=r.get('columna'))
    proyeccion = {
        **{k: copy.deepcopy(r[k]) for k in CAMPOS_TECNICOS_PUBLICOS},
        'filas_con_identidad_rota': canonicalizar_filas_rotas(r['filas_con_identidad_rota'], r['columna']),
        'authorization_sha256': auth_sha,
        'disposition_file_sha256': disposition_file_sha256,
    }
    if set(proyeccion.keys()) != set(CLAVES_PROYECCION_PUBLICA) or (
        set(proyeccion.keys()) & CLAVES_PRIVADAS_PROHIBIDAS
    ):
        raise ErrorDisposicion('disposicion_proyeccion_invalida')
    return proyeccion
