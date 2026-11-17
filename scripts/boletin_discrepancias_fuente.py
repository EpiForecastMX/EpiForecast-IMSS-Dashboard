"""Disposiciones nominales exactas para discrepancias impresas en la tabla de miasis.

Regla de gobernanza y privacidad (scripts/README_radar_boletin.md):
- Ningún bloque estatal ni fila del resumen nacional admite disposición: siguen fail-closed.
- Sin `--discrepancias-fuente`, cualquier columna de miasis que no sume su total o cuya identidad
  horizontal falle detiene la lectura (código 1, sin escribir archivos).
- El archivo completo de disposición (`schema: boletin_discrepancias_fuente.v1` obligatorio en
  ambas formas) y el acta se conservan únicamente en local fuera de toda raíz pública del sitio y
  de `--salida`. `cargar_disposiciones` calcula `disposition_file_sha256` sobre los bytes leídos y
  valida el formato nominal de `decision`; no abre `enlace_evidencia` ni recalcula el hash del acta
  (`evidencia_sha256` / `authorization_sha256` es un identificador declarado de provenancia, no
  firma criptográfica automática).
- La garantía de privacidad reside en la proyección por lista cerrada de 13 claves
  (`CLAVES_PROYECCION_PUBLICA`: 11 campos técnicos exactos más `authorization_sha256` y
  `disposition_file_sha256`), que jamás copia `decision`, autor, fecha, texto literal ni rutas.
- Toda disposición sobrante (PDF o columna que sí reconcilia) o con clave ajena falla cerrado.
- Registros `solo_pruebas: true` o `TEST_ONLY` nunca activan, historizan ni escriben en ningún
  árbol de sitio público detectado (salvaguarda acotada de operador; jamás copiar salidas externas
  de prueba dentro del sitio).
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from boletin_miasis_reglas import (
    CAMPOS_TECNICOS_PUBLICOS,
    CLAVES_DECISION,
    CLAVES_DECISION_OPC,
    CLAVES_PRIVADAS_PROHIBIDAS,
    CLAVES_PROYECCION_PUBLICA,
    CLAVES_REGISTRO,
    COLUMNAS_CONTEO_MIASIS,
    PLACEHOLDER_RE,
    SCHEMA,
    SHA256_RE,
    ErrorDisposicion,
    canonicalizar_filas_rotas,
    construir_problema_miasis,
    filas_identidad_rota_miasis,
    problemas_horizontales_sin_discrepancia_vertical,
    proyectar_discrepancia_publica,
    validar_registro,
)

__all__ = [
    'CAMPOS_TECNICOS_PUBLICOS', 'CLAVES_DECISION', 'CLAVES_DECISION_OPC',
    'CLAVES_PRIVADAS_PROHIBIDAS', 'CLAVES_PROYECCION_PUBLICA', 'CLAVES_REGISTRO',
    'COLUMNAS_CONTEO_MIASIS', 'PLACEHOLDER_RE', 'SCHEMA', 'SHA256_RE',
    'ErrorDisposicion', 'aplicar_a_miasis', 'canonicalizar_filas_rotas',
    'cargar_disposiciones', 'construir_problema_miasis', 'filas_identidad_rota_miasis',
    'problemas_horizontales_sin_discrepancia_vertical', 'proyectar_discrepancia_publica',
]


def cargar_disposiciones(ruta: Path, pdf_sha256: str) -> dict:
    """Lee un JSON local de disposiciones (`schema` obligatorio); no abre `enlace_evidencia`."""
    try:
        crudo = Path(ruta).expanduser().read_bytes()
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
        if doc.get('schema') != SCHEMA:
            raise ErrorDisposicion('disposicion_esquema_invalido', schema=doc.get('schema'))
        lista = [{k: v for k, v in doc.items() if k != 'schema'}]

    registros, vistos, solo_pruebas = [], set(), False
    for item in lista:
        validado, es_test = validar_registro(item, pdf_sha256)
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
    if not isinstance(cargadas, dict) or not isinstance(cargadas.get('registros'), list) or not cargadas['registros']:
        raise ErrorDisposicion('disposicion_esquema_invalido', detalle='estructura cargadas inválida')
    file_sha256 = cargadas.get('file_sha256')
    if not isinstance(file_sha256, str) or not SHA256_RE.match(file_sha256):
        raise ErrorDisposicion('disposicion_sha256_invalido', disposition_file_sha256=file_sha256)
    if tabla is None:
        return [*problemas_miasis, {'tipo': 'disposicion_sin_tabla_miasis'}]
    for r in cargadas['registros']:
        if not isinstance(r, dict) or 'pagina' not in r or 'columna' not in r:
            raise ErrorDisposicion('disposicion_esquema_invalido', detalle='registro malformado en cargadas')
    por_clave = {(r['pagina'], r['columna']): r for r in cargadas['registros']}
    usadas, errores = set(), []
    for p in problemas_miasis:
        if p.get('tipo') != 'miasis_reconciliacion' or p.get('pagina') != tabla.get('page'):
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
                'tipo': 'disposicion_sobrante', 'pagina': r['pagina'], 'columna': r['columna'],
                'detalle': 'la columna reconcilió exactamente; no admite disposición rancia o sobrante',
            })
    if errores:
        return errores
    cols_disc = {r['columna'] for r in cargadas['registros']}
    tabla['reconciliation'] = {
        'status': 'NO_RECONCILIADO',
        'columnas_ok': [k for k in COLUMNAS_CONTEO_MIASIS if k not in cols_disc],
        'discrepancias': [proyectar_discrepancia_publica(r, file_sha256) for r in cargadas['registros']],
    }
    return []
