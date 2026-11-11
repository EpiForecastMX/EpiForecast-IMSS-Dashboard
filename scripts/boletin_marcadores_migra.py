"""Restituye en el histórico de curvas el guion que el boletín imprimió y el radar guardó como 0.

Los tres extractores del radar (semanal, histórico 2025-2026 y archivo 2013-2024) convertían el
guion impreso en 0, así que el histórico no distingue «-» de un cero. Esta migración lo
restituye sólo donde la fuente lo sostiene, punto por punto:

1. Cada punto se coteja con su PDF fuente (página `p` de la fuente `s`). El script recalcula el
   sha256 de cada archivo y lo compara con el que registra `index.json`; la bandera del
   manifiesto no basta. Sin PDF cuyo digest coincida, el punto no se toca.
2. Evidencia positiva, no ausencia de evidencia. El punto se migra sólo si en la página se
   reconocen sus filas de datos (las 32 entidades y TOTAL si el punto tiene desglose estatal; una
   fila con código CIE si es del resumen nacional), esas filas imprimen al menos tantos guiones
   como ceros se van a restituir y ninguna imprime un «0» literal. Una página vacía, ilegible o
   sin filas reconocidas no autoriza nada: el punto queda sin migrar, con su motivo. Si la página
   imprime algún 0 literal tampoco se toca: no se puede saber celda por celda cuál era cuál.
3. Un punto con valores negativos publicados no se toca (una suma H+M puede dar 0 sin guiones).
4. La semana de la foto vigente se retira y se vuelve a agregar desde la foto corregida, igual
   que lo hace el comando semanal.

Nunca cambia una cifra distinta de 0 ni un valor ausente (None). Escribe un informe con los
sha256 anteriores y posteriores de cada archivo y la lista de puntos no migrados con su motivo.

    python3 scripts/boletin_marcadores_migra.py --foto assets/boletin/2026-w43-r1 \\
        --fuentes <dir-con-manifiesto.json> [--fuentes <otro>] --informe <ruta.json> [--escribir]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import boletin_semana_historia as historia  # noqa: E402
from boletin_celdas import GUION  # noqa: E402

CERO = re.compile(r'(?<!\S)0(?!\S)')
GUIONES = re.compile(r'(?<!\S)-(?!\S)')
CODIGO = re.compile(r'\b[A-Z]\d{2}(?:\.\d)?\b')
CAMPOS_ESCALARES = ('in_study', 'reported_weekly', 'reported_cumulative')


def filas_de_datos(texto: str, estados: list) -> dict:
    """Filas de datos reconocidas en la página: entidades, TOTAL y filas con código CIE."""
    entidades, total, codigos = set(), 0, 0
    filas = []
    for linea in texto.splitlines():
        s = linea.strip()
        if not s:
            continue
        # El prefijo más largo: «Baja California Sur» no es «Baja California». Antes de 2017 la
        # fila de la capital se imprime como «Distrito Federal».
        ent = max((e for e in estados if s.startswith(e)), key=len, default=None)
        if ent is None and s.startswith('Distrito Federal') and 'Ciudad de México' in estados:
            ent = 'Ciudad de México'
        if ent:
            entidades.add(ent)
        elif s.startswith('TOTAL'):
            total += 1
        elif CODIGO.search(linea):
            codigos += 1
        else:
            continue
        filas.append(s)
    return dict(filas=filas, entidades=len(entidades), total=total, codigos=codigos,
                ceros=[f for f in filas if CERO.search(f)],
                guiones=sum(len(GUIONES.findall(f)) for f in filas))


def filas_con_cero(texto: str, estados: list) -> list:
    """Filas de datos de la página que imprimen un 0 literal."""
    return filas_de_datos(texto, estados)['ceros']


def ceros_del_punto(p: dict) -> int:
    """Celdas del punto que valen 0 (las que se restituirían)."""
    n = 0
    for campo in ('n', 'e', 'in_study_states'):
        v = p.get(campo)
        pila = [v] if v is not None else []
        while pila:
            x = pila.pop()
            if isinstance(x, list):
                pila.extend(x)
            elif x == 0 and isinstance(x, int) and not isinstance(x, bool):
                n += 1
    return n + sum(1 for c in ('prev',) + CAMPOS_ESCALARES if c in p and p[c] == 0)


def motivo_para_no_migrar(p: dict, lectura: dict, estados: int) -> str | None:
    """None si la página da evidencia positiva para restituir los guiones del punto."""
    if not lectura['filas']:
        return 'pagina_sin_filas_de_datos_reconocidas'
    if lectura['ceros']:
        return 'pagina_con_cero_literal'
    if p.get('e') is not None and (lectura['entidades'] < estados or not lectura['total']):
        return 'pagina_sin_las_32_entidades_y_total'
    if p.get('e') is None and not lectura['codigos'] and lectura['entidades'] < estados:
        return 'pagina_sin_filas_nacionales'
    if ceros_del_punto(p) > lectura['guiones']:
        return 'menos_guiones_impresos_que_ceros'
    return None


def a_guion(v):
    if isinstance(v, list):
        return [a_guion(x) for x in v]
    return GUION if v == 0 and not isinstance(v, bool) and isinstance(v, int) else v


def migrar_punto(p: dict) -> int:
    """Cambia los 0 del punto por «-»; devuelve cuántas celdas cambió."""
    antes = json.dumps(p, sort_keys=True)
    cambios = 0

    def contar(a, b):
        nonlocal cambios
        if isinstance(a, list):
            for x, y in zip(a, b):
                contar(x, y)
        elif a != b:
            cambios += 1
    for campo in ('n', 'e', 'in_study_states'):
        if p.get(campo) is not None:
            nuevo = a_guion(p[campo])
            contar(p[campo], nuevo)
            p[campo] = nuevo
    for campo in ('prev',) + CAMPOS_ESCALARES:
        if campo in p and p[campo] == 0:
            p[campo] = GUION
            cambios += 1
    assert cambios or json.dumps(p, sort_keys=True) == antes
    return cambios


def texto_pagina(pdf: Path, pagina: int, cache: dict) -> str:
    clave = (pdf, pagina)
    if clave not in cache:
        r = subprocess.run(['pdftotext', '-f', str(pagina), '-l', str(pagina), '-layout',
                            str(pdf), '-'], capture_output=True, text=True)
        cache[clave] = r.stdout if r.returncode == 0 else ''
    return cache[clave]


def fuentes_verificadas(carpetas: list, esperados: set) -> tuple:
    """{sha256: ruta} sólo para archivos cuyo digest, recalculado aquí, está en el histórico."""
    pdfs, rechazados = {}, []
    for carpeta in map(Path, carpetas):
        for m in json.loads((carpeta / 'manifiesto.json').read_text()):
            if not m.get('archivo'):
                continue
            ruta = carpeta / m['archivo']
            real = sha(ruta) if ruta.exists() else None
            if real == m['sha256'] and real in esperados:
                pdfs[real] = ruta
            else:
                rechazados.append(dict(archivo=str(ruta), declarado=m['sha256'], real=real))
    return pdfs, rechazados


def sha(ruta: Path) -> str:
    return hashlib.sha256(ruta.read_bytes()).hexdigest()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--raiz', default=str(Path(__file__).resolve().parents[1]))
    ap.add_argument('--foto', required=True, help='foto corregida de la semana vigente')
    ap.add_argument('--fuentes', action='append', required=True,
                    help='carpeta con manifiesto.json (sha256, archivo, verificado)')
    ap.add_argument('--informe', required=True)
    ap.add_argument('--escribir', action='store_true')
    ap.add_argument('--cache-textos', help='JSON con el texto de cada página ya leída (se crea si '
                                           'no existe); evita releer los PDF entre corridas')
    a = ap.parse_args(argv)
    raiz = Path(a.raiz)
    hist = raiz / historia.DIR
    archivos = sorted(hist.glob('*.json')) + [hist / 'nacional-2013-2026.csv']
    sha_antes = {f.name: sha(f) for f in archivos}
    index, shards = historia.cargar(hist)
    pdfs, rechazados = fuentes_verificadas(a.fuentes, {s['sha256'] for s in index['sources']})

    foto = json.loads((Path(a.foto) / 'data.json').read_text())
    ultima = len(index['sources']) - 1
    fuente_foto = index['sources'][ultima]
    if fuente_foto['sha256'] != foto['meta']['pdf_sha256']:
        print('ERROR: la foto corregida no corresponde a la última fuente del histórico',
              file=sys.stderr)
        return 1

    cache, sin_fuente, con_cero, negativos, sin_evidencia = {}, [], {}, [], []
    if a.cache_textos and Path(a.cache_textos).exists():
        guardado = json.loads(Path(a.cache_textos).read_text())
        cache.update({(pdfs[k.split('#')[0]], int(k.split('#')[1])): v
                      for k, v in guardado.items() if k.split('#')[0] in pdfs})
    # Lectura en paralelo de todas las páginas que se van a cotejar.
    necesarias = {(pdfs[index['sources'][p['s']]['sha256']], p['p'])
                  for sh in shards.values() for lista in ('points', 'revisions', 'unplaced')
                  for p in sh[lista]
                  if p['s'] != ultima and index['sources'][p['s']]['sha256'] in pdfs}
    with ThreadPoolExecutor(8) as ex:
        list(ex.map(lambda k: texto_pagina(k[0], k[1], cache), sorted(necesarias)))
    celdas, puntos = 0, 0
    for ident, sh in shards.items():
        for lista in ('points', 'revisions', 'unplaced'):
            for p in sh[lista]:
                if p['s'] == ultima:
                    continue  # la semana vigente se rehace desde la foto corregida
                fuente = index['sources'][p['s']]
                pdf = pdfs.get(fuente['sha256'])
                ref = dict(id=ident, lista=lista, y=p['y'], w=p['w'], fuente=fuente['filename'],
                           pagina=p['p'])
                if pdf is None:
                    sin_fuente.append(ref)
                    continue
                if 'negative_values_reported' in p['flags']:
                    negativos.append(ref)
                    continue
                lectura = filas_de_datos(texto_pagina(pdf, p['p'], cache), index['states'])
                motivo = motivo_para_no_migrar(p, lectura, len(index['states']))
                if motivo == 'pagina_con_cero_literal':
                    clave = f"{fuente['filename']} p.{p['p']}"
                    con_cero.setdefault(clave, dict(filas=lectura['ceros'][:3], puntos=[]))
                    con_cero[clave]['puntos'].append(ident)
                    continue
                if motivo:
                    if ceros_del_punto(p):
                        sin_evidencia.append(dict(ref, motivo=motivo))
                    continue
                n = migrar_punto(p)
                celdas += n
                puntos += bool(n)

    if a.cache_textos:
        inverso = {v: k for k, v in pdfs.items()}
        Path(a.cache_textos).write_text(json.dumps(
            {f'{inverso[ruta]}#{pag}': t for (ruta, pag), t in cache.items() if ruta in inverso},
            ensure_ascii=False))
    # Semana vigente: se retira y se agrega desde la foto corregida (mismo código semanal).
    historia.retirar_ultima(index, shards)
    revisadas = historia.incorporar(index, shards, foto, fuente_foto['url'],
                                    fuente_foto['sha256'], index['checked'])
    plan = {hist / 'index.json': historia.compacto(index).encode('utf-8'),
            hist / 'nacional-2013-2026.csv': historia.csv_nacional(index, shards)}
    for k, s in shards.items():
        plan[hist / index['series'][k]['path'].rsplit('/', 1)[1]] = \
            historia.compacto(s).encode('utf-8')
    informe = dict(
        schema='boletin_migracion_guiones.v1',
        regla=('Un 0 guardado se restituye como «-» sólo si la página fuente verificada por sha256 '
               'no imprime ningún 0 literal en sus filas de datos y el punto no tiene valores '
               'negativos. La semana vigente se rehace desde la foto corregida.'),
        foto=str(Path(a.foto).resolve().relative_to(raiz.resolve())),
        fuentes_verificadas=len(pdfs), fuentes_del_historico=len(index['sources']),
        puntos_migrados=puntos, celdas_restituidas=celdas,
        fuentes_rechazadas_por_digest=rechazados,
        puntos_sin_fuente=sin_fuente, puntos_con_valores_negativos=len(negativos),
        puntos_sin_evidencia_positiva=sin_evidencia,
        paginas_con_cero_literal=con_cero, revisiones_nuevas=revisadas,
        sha256_antes=sha_antes)
    if a.escribir:
        historia.aplicar(dict(plan=plan))
        informe['sha256_despues'] = {f.name: sha(f) for f in archivos}
    Path(a.informe).write_text(json.dumps(informe, ensure_ascii=False, indent=1) + '\n',
                               encoding='utf-8')
    print(f'{puntos} puntos migrados, {celdas} celdas restituidas; sin fuente {len(sin_fuente)}, '
          f'páginas con 0 literal {len(con_cero)}, puntos con negativos {len(negativos)}, '
          f'sin evidencia positiva {len(sin_evidencia)}, fuentes rechazadas {len(rechazados)}.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
