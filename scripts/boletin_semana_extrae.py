"""Lectura del PDF de un boletín semanal del SINAVE para el radar del boletín.

Porta la lógica de la extracción de la semana 42 (extract.py, national.py y prepare.py
de la primera publicación) sin páginas ni semanas fijas: los cuadros estatales se
detectan por su contenido, las columnas por sus encabezados y los años por el año del
boletín. Nada se rellena: una celda ilegible o un bloque que no reconcilia se reporta
como problema y el generador se detiene.

Requiere Poppler (pdftotext, pdftoppm) y Tesseract.
"""
from __future__ import annotations

import re
import subprocess
import tempfile
import xml.etree.ElementTree as E
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

NS = {'x': 'http://www.w3.org/1999/xhtml'}
ENCABEZADOS_NO_ENTIDAD = {'H', 'M', 'Acum.', 'FEDERATIVA', 'ENTIDAD', 'Sem.'}


class ErrorExtraccion(Exception):
    """Errores acumulados de lectura; el generador los lista y termina con código 1."""

    def __init__(self, problemas: list):
        super().__init__(f'{len(problemas)} problemas de extracción')
        self.problemas = problemas


# Geometría de palabras y líneas de pdftotext -bbox-layout, normalizada a 540 × 720 pt.
def _escala(p):
    return 540 / float(p.get('width')), 720 / float(p.get('height'))


def palabras(p):
    sx, sy = _escala(p)
    return [dict(t=w.text or '', x=float(w.get('xMin')) * sx, r=float(w.get('xMax')) * sx,
                 y=float(w.get('yMin')) * sy, b=float(w.get('yMax')) * sy)
            for w in p.findall('.//x:word', NS)]


def lineas(p):
    sx, sy = _escala(p)
    return [dict(t=' '.join(w.text or '' for w in ln), x=float(ln.get('xMin')) * sx,
                 r=float(ln.get('xMax')) * sx, y=float(ln.get('yMin')) * sy,
                 b=float(ln.get('yMax')) * sy)
            for ln in p.findall('.//x:line', NS)]


def sin_duplicados(items):
    """El PDF repite algunas capas de texto; se conserva una copia por posición."""
    out = []
    for w in sorted(items, key=lambda a: -a['y']):
        if not any(w['t'] == v['t'] and abs(w['x'] - v['x']) < .3 and abs(w['y'] - v['y']) < 4
                   for v in out):
            out.append(w)
    return out


def celdas(ws):
    """Une las palabras de una misma cifra (separador de miles con espacio)."""
    out, vistos = [], set()
    for w in sorted(ws, key=lambda a: a['x']):
        clave = (w['t'], round(w['x'], 1), round(w['y'], 1))
        if clave in vistos:
            continue
        vistos.add(clave)
        if out and w['x'] - out[-1]['r'] < 5:
            out[-1]['t'] += w['t']
            out[-1]['r'] = w['r']
        else:
            out.append(w.copy())
    return out


def valor(t: str) -> int:
    """«-» es cero notificado; una cifra con signo se conserva; lo demás es ilegible."""
    t = t.replace(',', '').replace(' ', '')
    if t == '-':
        return 0
    # «145-»: guion de la celda vecina fundido en la misma palabra; la reconciliación lo vigila.
    if re.fullmatch(r'\d+-', t):
        t = t[:-1]
    if not re.fullmatch(r'-?\d+', t):
        raise ValueError(t)
    return int(t)


def paginas_xml(pdf: Path, destino: Path) -> list:
    xml = destino / 'bbox.html'
    subprocess.run(['pdftotext', '-bbox-layout', str(pdf), str(xml)], check=True,
                   stderr=subprocess.DEVNULL)
    return E.parse(xml).findall('.//x:page', NS)


def texto_layout(pdf: Path) -> bytes:
    return subprocess.run(['pdftotext', '-layout', str(pdf), '-'], check=True,
                          capture_output=True).stdout


def sin_guiones_pegados(ws):
    """Un «-» encimado o pegado a una cifra es un artefacto de la capa de texto, no una celda."""
    return [w for w in ws if w['t'] != '-' or not any(
        v['t'].isdigit() and v['x'] < w['r'] and v['r'] + 5 > w['x'] and abs(v['y'] - w['y']) < 4
        for v in ws)]


def acumulados(columnas: list, valores: list, observado: int) -> int:
    """Suma de las columnas de acumulado del año observado: H y M, estadios o la única."""
    return sum(v for c, v in zip(columnas, valores)
               if c in ('H', 'M') or ' estadio ' in c or c == f'Acum. {observado}')


def es_encabezado(t: str) -> bool:
    return any(k in t for k in ('CUADRO', 'hasta la', 'semana epidemiol', 'por Vacunac'))


def es_pagina_estatal(ws) -> bool:
    ts = {w['t'] for w in ws}
    return {'TOTAL', 'ENTIDAD', 'Sem.'} <= ts


# Cuadros estatales ---------------------------------------------------------------------
def _limites(sems, j, n):
    izquierda = sems[j]['x'] - 10
    derecha = sems[j + 1]['x'] - 10 if j + 1 < n else 510
    return izquierda, derecha


def encabezado_texto(p) -> str:
    """Título del cuadro cuando el PDF lo trae como texto; vacío si es imagen."""
    ls = sin_duplicados(lineas(p))
    cis = [ln['y'] for ln in ls if 'CIE-' in ln['t']]
    tope = min(cis) if cis else 120
    titulo = [ln for ln in sorted(ls, key=lambda a: (a['y'], a['x']))
              if 60 < ln['y'] < tope and ln['x'] < 510 and es_encabezado(ln['t'])]
    texto = ' '.join(ln['t'] for ln in titulo)
    return texto if 'CUADRO' in texto and 'hasta' in texto else ''


def bloques_estatales(pn: int, p, anio: int, problemas: list) -> list:
    """Bloques (padecimientos) de una página de cuadro estatal, con sus 32 entidades."""
    ws, ls = sin_duplicados(palabras(p)), sin_duplicados(lineas(p))
    total = next(w for w in ws if w['t'] == 'TOTAL')
    cs = celdas(sin_guiones_pegados([w for w in ws if abs(w['y'] - total['y']) < 2
                                     and w['x'] > 120]))
    sems = sorted([w for w in ws if w['t'] == 'Sem.' and w['y'] < 230], key=lambda a: a['x'])
    cis = sorted([ln for ln in ls if 'CIE-' in ln['t'] and 90 < ln['y'] < 175],
                 key=lambda a: a['x'])
    estadios = any(w['t'].startswith('Estadio') for w in ws) or any(
        'inmunodeficiencia' in ln['t'] for ln in ls)
    if estadios:
        # VIH: un solo bloque con cuatro estadios clínicos por sexo; algunas ediciones
        # agregan la semana del año anterior con un segundo rótulo «Sem.».
        cis, sems = cis[:1], sems[:1]
    n = len(cis)
    if len(sems) != n:
        problemas.append(dict(pagina=pn, tipo='encabezados', detalle=f'CIE {n}, Sem. {len(sems)}'))
        return []
    # El boletín de la semana 1 todavía puede observar el año anterior.
    anios_txt = {str(anio), str(anio - 1)}
    marcas = [w for w in ws if w['t'] in anios_txt and 145 < w['y'] < 220]
    if not marcas:
        problemas.append(dict(pagina=pn, tipo='año', detalle='sin rótulo de año en el cuadro'))
        return []
    anio_alto = max(w['t'] for w in marcas)
    y_anio = min(w['y'] for w in marcas if w['t'] == anio_alto)
    centros = [(c['x'] + c['r']) / 2 for c in cis]
    nombres, codigos = [[] for _ in cis], [[] for _ in cis]
    for ln in sorted(ls, key=lambda a: (a['y'], a['x'])):
        if ln['x'] < 120 or not 90 < ln['y'] < y_anio - 1 or es_encabezado(ln['t']):
            continue
        j = min(range(n), key=lambda k: abs((ln['x'] + ln['r']) / 2 - centros[k]))
        (nombres if ln['y'] < cis[j]['y'] - 1 else codigos)[j].append(ln['t'])
    etiquetas = [ln for ln in ls if ln['x'] < 115 and y_anio + 20 < ln['y'] < total['y'] - 5
                 and ln['r'] < 132]
    entidades = [ln for ln in sorted(etiquetas, key=lambda a: a['y'])
                 if ln['t'] not in ENCABEZADOS_NO_ENTIDAD and not ln['t'].isdigit()]
    if len(entidades) != 32:
        problemas.append(dict(pagina=pn, tipo='entidades', detalle=f'{len(entidades)} de 32'))
        return []
    techo = min(s['y'] for s in entidades) - 3
    out = []
    for j in range(n):
        izq, der = _limites(sems, j, n)
        grupo = [c for c in cs if izq <= c['x'] < der]
        nombre = re.sub(r'[§&]', '', ' '.join(nombres[j])).strip()
        codigo = re.sub(r'CIE-10ª\s*REV\.?', '', ' '.join(codigos[j])).strip()
        etiqueta = dict(pagina=pn, bloque=j + 1, nombre=nombre, codigo=codigo)
        try:
            totales = [valor(c['t']) for c in grupo]
        except ValueError as e:
            problemas.append(dict(etiqueta, tipo='total_ilegible', detalle=str(e)))
            continue
        anios_bloque = [int(w['t']) for w in marcas if izq < w['x'] < der]
        observado = max(anios_bloque) if anios_bloque else anio
        if estadios:
            columnas = ['Sem.'] + [f'{s} estadio {k}' for k in range(1, 5) for s in ('H', 'M')]
            columnas += [f'Sem. {observado - 1}'] if len(totales) == 11 else []
            columnas += [f'Acum. {observado - 1}']
        else:
            previo = any(w['t'] == str(observado - 1) and izq < w['x'] < der
                         and abs((w['x'] + w['r']) / 2 - centros[j]) < 100 for w in ws)
            sexos = [w['t'] for w in sorted(ws, key=lambda a: a['x'])
                     if w['t'] in ('H', 'M') and y_anio < w['y'] < techo and izq < w['x'] < der]
            columnas = ['Sem.'] + (sexos or [f'Acum. {observado}'])
            columnas += [f'Acum. {observado - 1}'] if previo else []
        if len(columnas) != len(totales):
            problemas.append(dict(etiqueta, tipo='columnas', columnas=columnas, totales=totales))
            continue
        filas, ilegibles = [], []
        for st in entidades:
            fila = sin_guiones_pegados([w for w in ws if abs(w['y'] - st['y']) < 2
                                        and w['x'] > 125])
            crudos = ['' for _ in grupo]
            for w in sorted(fila, key=lambda a: a['x']):
                k = min(range(len(cs)), key=lambda i: abs(cs[i]['r'] - w['r']))
                if cs[k] in grupo:
                    crudos[grupo.index(cs[k])] += w['t']
            try:
                filas.append(dict(state=st['t'], values=[valor(t) for t in crudos]))
            except ValueError:
                ilegibles.append(dict(entidad=st['t'], celdas=crudos))
        if ilegibles:
            problemas.append(dict(etiqueta, tipo='celdas_ilegibles', detalle=ilegibles))
            continue
        sumas = [sum(f['values'][k] for f in filas) for k in range(len(totales))]
        if sumas != totales:
            problemas.append(dict(etiqueta, tipo='reconciliacion', impreso=totales, sumado=sumas))
            continue
        etiqueta_previo = f'Acum. {observado - 1}'
        previo_valor = totales[columnas.index(etiqueta_previo)] if etiqueta_previo in columnas \
            else None
        out.append(dict(nombre=nombre, codigo=codigo, page=pn, columns=columnas,
                        totals=totales, states=filas, weekly=totales[0],
                        cumulative=acumulados(columnas, totales, observado),
                        previous=previo_valor,
                        anio_observado=observado, estadios=estadios))
    return out


# Resumen nacional (notificación inmediata y semanal) ---------------------------------
def es_pagina_nacional(ls) -> bool:
    ts = ' '.join(ln['t'] for ln in ls)
    return 'ENFERMEDAD' in ts and 'MEDIANA' in ts and 'CIE-' in ts and 'ENTIDAD' not in ts


NUMERO = re.compile(r'[\d ,]+|-')


def filas_nacionales(pn: int, p, problemas: list) -> tuple:
    ls = sin_duplicados(lineas(p))
    cie = next(ln for ln in ls if 'CIE-' in ln['t'])
    centro_cie = (cie['x'] + cie['r']) / 2
    rotulos = sorted([ln for ln in ls if ln['b'] < cie['b'] + 25 and ln['y'] > cie['y'] - 15
                      and re.fullmatch(r'20\d\d(?:-20\d\d)?', ln['t'])], key=lambda a: a['x'])
    if len(rotulos) != 5:
        problemas.append(dict(pagina=pn, tipo='nacional_encabezados', detalle=len(rotulos)))
        return [], []
    # La primera columna numérica empieza después del código y termina antes de la segunda.
    corte_1 = (rotulos[0]['r'] + rotulos[1]['x']) / 2
    inicio = cie['r'] + 5
    fuentes = [ln['y'] for ln in ls if ln['t'].startswith(('§FUENTE', 'FUENTE'))]
    fondo = min(fuentes) if fuentes else 680
    anclas = sorted([ln for ln in ls if inicio < ln['x'] and ln['r'] < corte_1
                     and rotulos[0]['b'] < ln['y'] < fondo
                     and NUMERO.fullmatch(ln['t'])], key=lambda a: a['y'])
    out, bandas = [], []
    for k, a in enumerate(anclas):
        y = a['y']
        lo = (anclas[k - 1]['y'] + y) / 2 if k else y - 9
        hi = (anclas[k + 1]['y'] + y) / 2 if k + 1 < len(anclas) else y + 12
        bandas.append((lo, hi))
        vals = sorted([ln for ln in ls if ln['x'] > inicio - 5 and abs(ln['y'] - y) < 2
                       and (NUMERO.fullmatch(ln['t']) or ln['t'] == 'n.d.')],
                      key=lambda a: a['x'])
        banda = sorted([ln for ln in ls if lo <= ln['y'] < hi], key=lambda a: a['y'])
        nombre = ' '.join(ln['t'] for ln in banda if (ln['x'] + ln['r']) / 2 < centro_cie - 45
                          and ln['r'] < cie['x'])
        codigo = ' '.join(ln['t'] for ln in banda if abs((ln['x'] + ln['r']) / 2 - centro_cie) < 45
                          and not NUMERO.fullmatch(ln['t']))
        # Cada cifra va a la columna cuyo rótulo tiene el borde derecho más cercano (están
        # alineadas a la derecha); una celda en blanco queda como no disponible, nunca cero.
        celdas_fila = [None] * 5
        repetidas = False
        for v in vals:
            c = min(range(5), key=lambda i: abs(rotulos[i]['r'] - v['r']))
            repetidas |= celdas_fila[c] is not None
            celdas_fila[c] = v['t']
        if repetidas or not nombre or not codigo:
            problemas.append(dict(pagina=pn, tipo='nacional_fila', nombre=nombre, codigo=codigo,
                                  valores=[v['t'] for v in vals]))
            continue
        try:
            v = [None if t in (None, 'n.d.') else valor(t) for t in celdas_fila]
        except ValueError as e:
            problemas.append(dict(pagina=pn, tipo='nacional_ilegible', nombre=nombre,
                                  detalle=str(e)))
            continue
        out.append(dict(page=pn, name=nombre, code=codigo, weekly=v[0], cumulative=v[1],
                        median=v[2], weekly_previous=v[3], previous=v[4]))
    # Una fila sin cifra en la primera columna no tendría ancla: no puede desaparecer en silencio.
    for ln in ls:
        centro = (ln['x'] + ln['r']) / 2
        if (abs(centro - centro_cie) < 45 and rotulos[0]['b'] < ln['y'] < fondo
                and not NUMERO.fullmatch(ln['t'])
                and not any(lo <= ln['y'] < hi for lo, hi in bandas)):
            problemas.append(dict(pagina=pn, tipo='nacional_fila_sin_ancla', codigo=ln['t']))
    return out, [ln['t'] for ln in rotulos]


# Miasis por Cochliomyia hominivorax (cuadro complementario) -------------------------
MESES = ('enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre '
         'diciembre').split()


def es_pagina_miasis(texto: str) -> bool:
    return 'Estado notificante' in texto and 'hominivorax' in texto


# Fila de la tabla en el texto con diseño: entidad (o «Total de casos») y diez cifras.
# Algunas ediciones imprimen el folio de la página girada al inicio de una fila.
FILA_MIASIS = re.compile(r'^\s*(?:\d+\s+)?([^\d\s].*?)\s+((?:-?\d[\d.,]*%?\s+){9}-?\d[\d.,]*%?)\s*$')


def miasis(pn: int, texto: str, anio: int, problemas: list):
    """Tabla de casos confirmados por estado notificante, desde el texto con diseño."""
    filas, totales = [], None
    for linea in texto.splitlines():
        m = FILA_MIASIS.match(linea)
        if not m:
            continue
        nombre = ' '.join(m.group(1).split())
        try:
            valores = [float(t.rstrip('%').replace(',', '')) for t in m.group(2).split()]
        except ValueError:
            problemas.append(dict(pagina=pn, tipo='miasis_ilegible', fila=linea.strip()))
            continue
        if nombre.startswith('Total'):
            totales = [int(v) for v in valores]
        else:
            filas.append(dict(state=nombre, values=valores))
    if totales is None or not filas:
        problemas.append(dict(pagina=pn, tipo='miasis_estructura', filas=len(filas)))
        return None
    for k in (0, 2, 3, 5, 6, 7, 9):
        if sum(f['values'][k] for f in filas) != totales[k]:
            problemas.append(dict(pagina=pn, tipo='miasis_reconciliacion', columna=k))
    plano = ' '.join(texto.split())
    corte = re.search(r'Fecha de corte:\s*(\d{1,2} de (?:%s) de \d{4})' % '|'.join(MESES), plano)
    if not corte:
        problemas.append(dict(pagina=pn, tipo='miasis_corte'))
        return None
    reclasificados = re.search(r'Se reclasificaron (\d+) casos? a descartados', plano)
    notas = [' '.join(linea.split()) for linea in texto.splitlines()
             if linea.strip().startswith('*')]
    columnas = [f'Casos {anio - 1}', f'% {anio - 1}', f'Defunciones {anio - 1}', f'Casos {anio}',
                f'% {anio}', f'Defunciones {anio}', 'Confirmados últimos 7 días',
                f'Casos {anio - 1}–{anio}', '% total', 'Defunciones totales']
    return dict(name='Miasis humana confirmada por Cochliomyia hominivorax', page=pn,
                cut=corte.group(1), columns=columnas, totals=totales, states=filas,
                reclassified_to_discarded=int(reclasificados.group(1)) if reclasificados else None,
                notes=notas)


# Encabezados de los cuadros: son imagen en el PDF y se leen con OCR ------------------
def ocr_encabezados(pdf: Path, paginas: list) -> dict:
    """Recorte de 900 × 85 px a escala 1200 bajo el membrete; Tesseract --psm 6."""
    tmp = Path(tempfile.mkdtemp(prefix='boletin-ocr-'))

    def uno(pn):
        base = tmp / f'p-{pn:02d}'
        subprocess.run(['pdftoppm', '-f', str(pn), '-l', str(pn), '-scale-to', '1200', '-x', '0',
                        '-y', '100', '-W', '900', '-H', '85', '-png', '-singlefile', str(pdf),
                        str(base)], check=True, stderr=subprocess.DEVNULL)
        r = subprocess.run(['tesseract', str(base) + '.png', 'stdout', '--psm', '6'],
                           capture_output=True, text=True)
        return pn, r.stdout.strip()

    with ThreadPoolExecutor(6) as ex:
        return dict(ex.map(uno, paginas))


def leer(pdf: Path, anio: int, texto: bytes | None = None) -> dict:
    """Extrae todo el boletín; lanza ErrorExtraccion con cada problema encontrado."""
    problemas: list = []
    texto = texto if texto is not None else texto_layout(pdf)
    paginas_texto = texto.decode('utf-8', 'replace').split('\f')
    with tempfile.TemporaryDirectory(prefix='boletin-xml-') as tmp:
        paginas = paginas_xml(pdf, Path(tmp))
    estatales, nacionales, mias, paginas_estatales, rotulos = [], [], None, [], []
    titulos = {}
    for pn, p in enumerate(paginas, 1):
        ws = sin_duplicados(palabras(p))
        ls = sin_duplicados(lineas(p))
        if es_pagina_estatal(ws):
            paginas_estatales.append(pn)
            titulos[pn] = encabezado_texto(p)
            try:
                estatales += bloques_estatales(pn, p, anio, problemas)
            except StopIteration:
                problemas.append(dict(pagina=pn, tipo='estructura_estatal'))
        elif es_pagina_nacional(ls):
            filas, rot = filas_nacionales(pn, p, problemas)
            if rotulos and rot and rot != rotulos:
                problemas.append(dict(pagina=pn, tipo='nacional_rotulos', detalle=[rotulos, rot]))
            nacionales += filas
            rotulos = rotulos or rot
        elif pn <= len(paginas_texto) and es_pagina_miasis(paginas_texto[pn - 1]):
            mias = miasis(pn, paginas_texto[pn - 1], anio, problemas)
    if not estatales:
        problemas.append(dict(tipo='sin_cuadros_estatales'))
    if not nacionales:
        problemas.append(dict(tipo='sin_resumen_nacional'))
    if mias is None:
        problemas.append(dict(tipo='sin_miasis'))
    if problemas:
        raise ErrorExtraccion(problemas)
    return dict(estatales=estatales, nacionales=nacionales, miasis=mias,
                paginas_estatales=paginas_estatales, rotulos_nacionales=rotulos,
                titulos=titulos)
