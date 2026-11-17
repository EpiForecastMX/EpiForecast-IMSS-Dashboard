"""Disposiciones nominales exactas para discrepancias impresas en la tabla de miasis.

Regla de gobernanza y privacidad (scripts/README_radar_boletin.md):
- Ningún bloque estatal ni fila del resumen nacional admite disposición: siguen fail-closed.
- Sin `--discrepancias-fuente`, cualquier columna de miasis que no sume su total detiene la
  lectura (código 1, sin escribir archivos) y reporta suma, total, delta y filas rotas.
- El archivo completo de disposición y el acta de autorización se conservan únicamente en local
  fuera de `assets/` y del repositorio público; `cargar_disposiciones` valida localmente la
  nominalidad completa y sus hashes SHA-256 sin inventar firmas criptográficas humanas.
- `aplicar_a_miasis` proyecta a artefactos públicos únicamente campos técnicos exactos
  (`pdf_sha256` de 64 hex, `pagina`, `cuadro`, `columna`, `nombre_columna`, `suma_estados`,
  `total_impreso`, `delta`, `filas_con_identidad_rota`, `estado == 'NO_RECONCILIADO'`,
  `celdas_modificadas == 0`) y los dos hashes de trazabilidad (`authorization_sha256` y
  `disposition_file_sha256`), sin publicar `decision`, autor, fecha, texto literal ni rutas.
- Toda disposición sobrante (PDF o columna que sí reconcilia) o con clave ajena falla cerrado.
- Registros marcados `solo_pruebas: true` o `TEST_ONLY` nunca pueden activar ni historizar.
"""
from __future__ import annotations

import copy
import hashlib
import json
import re
from datetime import date
from pathlib import Path

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


def _es_entero(v) -> bool:
    return isinstance(v, int) and not isinstance(v, bool)


def _texto_real(v) -> bool:
    return isinstance(v, str) and bool(v.strip()) and not PLACEHOLDER_RE.match(v.strip())


def filas_identidad_rota_miasis(filas: list, columna: int) -> list[dict]:
    """Filas cuya identidad horizontal de conteos falla para la familia de `columna`."""
    out = []
    if columna in (0, 3, 7):
        for f in filas:
            c0, c3, c7 = int(f['values'][0]), int(f['values'][3]), int(f['values'][7])
            if c0 + c3 != c7:
                out.append({'estado': f['state'], 'col0': c0, 'col3': c3, 'col7_impreso': c7})
    elif columna in (2, 5, 9):
        for f in filas:
            c2, c5, c9 = int(f['values'][2]), int(f['values'][5]), int(f['values'][9])
            if c2 + c5 != c9:
                out.append({'estado': f['state'], 'col2': c2, 'col5': c5, 'col9_impreso': c9})
    return out


def construir_problema_miasis(pn: int, columna: int, nombre_columna: str,
                              filas: list, totales: list) -> dict | None:
    """Devuelve el problema detallado si la columna `columna` no cuadra con `totales`."""
    bruto = sum(f['values'][columna] for f in filas)
    suma_col = int(bruto) if float(bruto).is_integer() else bruto
    total_col = totales[columna]
    if suma_col == total_col:
        return None
    return {
        'pagina': pn,
        'tipo': 'miasis_reconciliacion',
        'cuadro': 'miasis',
        'columna': columna,
        'nombre_columna': nombre_columna,
        'suma_estados': suma_col,
        'total_impreso': total_col,
        'delta': total_col - suma_col,
        'filas_con_identidad_rota': filas_identidad_rota_miasis(filas, columna),
    }


def _validar_filas_rotas(filas_rotas, columna: int) -> None:
    if not isinstance(filas_rotas, list):
        raise ErrorDisposicion('disposicion_filas_invalidas', detalle='debe ser lista')
    esperadas = ({'estado', 'col0', 'col3', 'col7_impreso'} if columna in (0, 3, 7)
                 else {'estado', 'col2', 'col5', 'col9_impreso'} if columna in (2, 5, 9)
                 else None)
    if esperadas is None and filas_rotas:
        raise ErrorDisposicion('disposicion_filas_invalidas', columna=columna)
    for item in filas_rotas:
        if not isinstance(item, dict) or set(item.keys()) != esperadas or not _texto_real(item['estado']):
            raise ErrorDisposicion('disposicion_filas_invalidas', item=item)
        if columna in (0, 3, 7):
            if not all(_es_entero(item[k]) for k in ('col0', 'col3', 'col7_impreso')):
                raise ErrorDisposicion('disposicion_filas_invalidas', item=item)
            if item['col0'] + item['col3'] == item['col7_impreso']:
                raise ErrorDisposicion('disposicion_filas_invalidas', item=item)
        else:
            if not all(_es_entero(item[k]) for k in ('col2', 'col5', 'col9_impreso')):
                raise ErrorDisposicion('disposicion_filas_invalidas', item=item)
            if item['col2'] + item['col5'] == item['col9_impreso']:
                raise ErrorDisposicion('disposicion_filas_invalidas', item=item)


def _validar_decision(dec) -> bool:
    if not isinstance(dec, dict):
        raise ErrorDisposicion('disposicion_decision_invalida', detalle='decision no es objeto')
    claves = set(dec.keys())
    if not CLAVES_DECISION.issubset(claves) or not claves.issubset(CLAVES_DECISION | CLAVES_DECISION_OPC):
        raise ErrorDisposicion('disposicion_decision_invalida', claves=sorted(claves))
    for campo in ('autor', 'texto_literal', 'enlace_evidencia'):
        if not _texto_real(dec[campo]):
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


def _validar_registro(r, pdf_sha256: str) -> tuple[dict, bool]:
    if not isinstance(r, dict):
        raise ErrorDisposicion('disposicion_esquema_invalido', detalle='registro no es objeto')
    if r.get('cuadro') != 'miasis':
        raise ErrorDisposicion(
            'disposicion_ambito_prohibido',
            cuadro=r.get('cuadro'),
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
    if not _es_entero(r['pagina']) or r['pagina'] < 1:
        raise ErrorDisposicion('disposicion_pagina_invalida', pagina=r['pagina'])
    if not _es_entero(r['columna']) or r['columna'] not in COLUMNAS_CONTEO_MIASIS:
        raise ErrorDisposicion('disposicion_columna_invalida', columna=r['columna'])
    if not _texto_real(r['nombre_columna']):
        raise ErrorDisposicion('disposicion_columna_invalida', nombre_columna=r['nombre_columna'])
    if not all(_es_entero(r[k]) for k in ('suma_estados', 'total_impreso', 'delta')):
        raise ErrorDisposicion('disposicion_cifras_invalidas')
    if r['delta'] == 0 or r['total_impreso'] - r['suma_estados'] != r['delta']:
        raise ErrorDisposicion('disposicion_delta_inconsistente', delta=r['delta'])
    if r['estado'] != 'NO_RECONCILIADO':
        raise ErrorDisposicion('disposicion_estado_prohibido', estado=r['estado'])
    if not _es_entero(r['celdas_modificadas']) or r['celdas_modificadas'] != 0:
        raise ErrorDisposicion('disposicion_celdas_modificadas_prohibido', celdas_modificadas=r['celdas_modificadas'])
    _validar_filas_rotas(r['filas_con_identidad_rota'], r['columna'])
    solo_pruebas = _validar_decision(r['decision'])
    return copy.deepcopy(r), solo_pruebas


def proyectar_discrepancia_publica(r: dict, disposition_file_sha256: str) -> dict:
    """Proyecta sólo campos técnicos exactos y hashes SHA-256 de trazabilidad sin metadatos privados."""
    if not isinstance(disposition_file_sha256, str) or not SHA256_RE.match(disposition_file_sha256):
        raise ErrorDisposicion('disposicion_sha256_invalido', disposition_file_sha256=disposition_file_sha256)
    dec = r.get('decision')
    auth_sha = dec.get('evidencia_sha256') if isinstance(dec, dict) else None
    if not isinstance(auth_sha, str) or not SHA256_RE.match(auth_sha):
        raise ErrorDisposicion('disposicion_decision_invalida', campo='evidencia_sha256')
    proyeccion = {
        **{k: copy.deepcopy(r[k]) for k in CAMPOS_TECNICOS_PUBLICOS},
        'authorization_sha256': auth_sha,
        'disposition_file_sha256': disposition_file_sha256,
    }
    if set(proyeccion.keys()) != set(CLAVES_PROYECCION_PUBLICA) or (
        set(proyeccion.keys()) & CLAVES_PRIVADAS_PROHIBIDAS
    ):
        raise ErrorDisposicion('disposicion_proyeccion_invalida')
    return proyeccion


def cargar_disposiciones(ruta: Path, pdf_sha256: str) -> dict:
    """Lee y valida estrictamente un archivo JSON local de disposiciones para `pdf_sha256`."""
    try:
        crudo = Path(ruta).read_bytes()
    except OSError as e:
        raise ErrorDisposicion('disposicion_no_legible', detalle=type(e).__name__) from e
    file_sha256 = hashlib.sha256(crudo).hexdigest()
    try:
        doc = json.loads(crudo.decode('utf-8'))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise ErrorDisposicion('disposicion_json_invalido', detalle=str(e)) from e
    if not isinstance(doc, dict):
        raise ErrorDisposicion('disposicion_esquema_invalido', detalle='raíz debe ser objeto JSON')
    if 'discrepancias' in doc:
        if set(doc.keys()) != {'schema', 'discrepancias'} or doc.get('schema') != SCHEMA:
            raise ErrorDisposicion('disposicion_esquema_invalido', schema=doc.get('schema'))
        lista = doc['discrepancias']
        if not isinstance(lista, list) or not lista:
            raise ErrorDisposicion('disposicion_esquema_invalido', detalle='discrepancias vacía o inválida')
    else:
        if 'schema' in doc and doc['schema'] != SCHEMA:
            raise ErrorDisposicion('disposicion_esquema_invalido', schema=doc.get('schema'))
        lista = [{k: v for k, v in doc.items() if k != 'schema'}]

    registros, vistos, solo_pruebas = [], set(), False
    for item in lista:
        validado, es_test = _validar_registro(item, pdf_sha256)
        clave = (validado['pagina'], validado['cuadro'], validado['columna'])
        if clave in vistos:
            raise ErrorDisposicion('disposicion_duplicada', pagina=clave[0], columna=clave[2])
        vistos.add(clave)
        registros.append(validado)
        solo_pruebas = solo_pruebas or es_test
    return {'file_sha256': file_sha256, 'registros': registros, 'tiene_solo_pruebas': solo_pruebas}


def aplicar_a_miasis(tabla: dict | None, problemas_miasis: list, cargadas: dict | None) -> list:
    """Coteja problemas de reconciliación de miasis contra `cargadas`; proyecta sólo datos públicos."""
    if cargadas is None:
        return list(problemas_miasis)
    if tabla is None:
        return [*problemas_miasis, {'tipo': 'disposicion_sin_tabla_miasis'}]
    file_sha256 = cargadas.get('file_sha256', '')
    por_clave = {(r['pagina'], r['columna']): r for r in cargadas['registros']}
    usadas, errores = set(), []
    for p in problemas_miasis:
        if p.get('tipo') != 'miasis_reconciliacion':
            errores.append(p)
            continue
        clave = (p['pagina'], p['columna'])
        r = por_clave.get(clave)
        if r is None:
            errores.append(p)
            continue
        usadas.add(clave)
        coincide = all(r[k] == p[k] for k in (
            'nombre_columna', 'suma_estados', 'total_impreso', 'delta', 'filas_con_identidad_rota',
        ))
        if not coincide:
            errores.append({
                'tipo': 'disposicion_no_coincide',
                'observado': p,
                'declarado': proyectar_discrepancia_publica(r, file_sha256),
            })
    for clave, r in por_clave.items():
        if clave not in usadas:
            errores.append({
                'tipo': 'disposicion_sobrante',
                'pagina': r['pagina'],
                'columna': r['columna'],
                'detalle': 'la columna reconcilió exactamente; no admite disposición rancia o sobrante',
            })
    if errores:
        return errores
    cols_disc = {r['columna'] for r in cargadas['registros']}
    tabla['reconciliation'] = {
        'status': 'NO_RECONCILIADO',
        'columnas_ok': [k for k in COLUMNAS_CONTEO_MIASIS if k not in cols_disc],
        'discrepancias': [
            proyectar_discrepancia_publica(r, file_sha256)
            for r in cargadas['registros']
        ],
    }
    return []
