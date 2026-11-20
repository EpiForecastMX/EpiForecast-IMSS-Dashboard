"""Activa una foto semanal del radar: actual.json y el texto estático de boletin.html.

assets/boletin/actual.json es el único lugar que dice cuál foto está vigente; la página
lo lee al cargar. El HTML conserva además el texto ya rellenado (para lectura sin
JavaScript y para buscadores): este módulo valida primero la foto con `verificarMiasis`
y recalcula los textos con `assets/boletin/textos.mjs` en memoria antes de tocar ningún
archivo en disco, de modo que un fallo deja intactos `actual.json` y `boletin.html`.

Si existe no_modelables.html, también reescribe sus tablas (scripts/no_modelables_pagina.mjs).

Uso independiente (por ejemplo, tras editar a mano la cobertura de data.json):

    python3 scripts/boletin_semana_activa.py            # resincroniza con actual.json
    python3 scripts/boletin_semana_activa.py --carpeta assets/boletin/2026-w43 \\
        --pdf boletin-4326.pdf --volumen 43
"""
from __future__ import annotations

import argparse
import html
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from boletin_guardas_radar import resolver_modulo_textos  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
ACTUAL = 'assets/boletin/actual.json'

NODO = """
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
try {
  const [raiz, textosPath, actualJson] = process.argv.slice(1);
  const m = await import(pathToFileURL(textosPath).href);
  const leer = r => JSON.parse(readFileSync(resolve(raiz, r), 'utf8'));
  const actual = JSON.parse(actualJson);
  const data = leer(actual.carpeta + '/data.json');
  const verifRel = actual.carpeta + '/verification.json';
  const tieneVerif = existsSync(resolve(raiz, verifRel));
  if (data?.myiasis?.reconciliation && !tieneVerif) {
    throw new Error('verification.json es obligatorio cuando miasis declara reconciliation');
  }
  const verification = tieneVerif ? leer(verifRel) : null;
  m.verificarMiasis(data, verification);
  const histRel = 'assets/boletin/history/index.json';
  const historia = existsSync(resolve(raiz, histRel)) ? leer(histRel) : null;
  process.stdout.write(JSON.stringify({
    textos: m.textosRadar(data, actual, historia),
    enlaces: m.enlacesRadar(actual),
  }));
} catch (e) {
  process.stderr.write(String(e?.message || e) + '\\n');
  process.exit(1);
}
"""


def calcular(raiz: Path, actual: dict | None = None) -> dict:
    raiz = Path(raiz).expanduser()
    if actual is None:
        actual = json.loads((raiz / ACTUAL).read_text(encoding='utf-8'))
    modulo = resolver_modulo_textos(raiz, RAIZ)
    r = subprocess.run(
        ['node', '--input-type=module', '-e', NODO, str(raiz), str(modulo), json.dumps(actual)],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        detalle = (r.stderr or r.stdout).strip() or 'falló verificación de la foto'
        raise SystemExit(f'ERROR: no se puede activar la foto: {detalle}')
    return json.loads(r.stdout)


def rellenar(plantilla: str, textos: dict) -> str:
    return re.sub(r'\{([\w:.-]+)\}', lambda m: textos.get(m.group(1), m.group(0)), plantilla)


def sincronizar_html(texto: str, textos: dict, enlaces: dict) -> tuple:
    """Devuelve el HTML con valores y enlaces de la foto vigente, y las claves desconocidas."""
    faltan = []

    def valor(m):
        clave = m.group(2)
        if clave not in textos:
            faltan.append(clave)
            return m.group(0)
        return m.group(1) + html.escape(textos[clave], quote=False) + m.group(3)

    texto = re.sub(r'(<span data-radar="([^"]+)">)[^<]*(</span>)', valor, texto)

    def plantilla(m):
        return m.group(1) + html.escape(rellenar(html.unescape(m.group(3)), textos),
                                        quote=False) + m.group(4)

    texto = re.sub(r'(<(\w+)\b[^>]*\bdata-radar-plantilla="([^"]*)"[^>]*>)[^<]*(</\2>)',
                   plantilla, texto)

    def contenido(m):
        tag = m.group(0)
        nuevo = html.escape(rellenar(html.unescape(m.group(1)), textos), quote=True)
        return re.sub(r'(?<![\w-])content="[^"]*"', f'content="{nuevo}"', tag)

    texto = re.sub(r'<meta\b[^>]*\bdata-radar-content="([^"]*)"[^>]*>', contenido, texto)

    def enlace(m):
        tag, clave = m.group(0), m.group(1)
        if clave not in enlaces:
            faltan.append(clave)
            return tag
        return re.sub(r'(?<![\w-])href="[^"]*"', f'href="{enlaces[clave]}"', tag)

    texto = re.sub(r'<a\b[^>]*\bdata-radar-enlace="([^"]+)"[^>]*>', enlace, texto)
    return texto, faltan


def activar(raiz: Path, carpeta: str | None = None, pdf: str | None = None,
            volumen: int | None = None) -> None:
    raiz = Path(raiz).expanduser()
    ruta = raiz / ACTUAL
    previo = json.loads(ruta.read_text(encoding='utf-8')) if ruta.exists() else {}
    if carpeta:
        actual = dict(schema='boletin_actual.v1', carpeta=carpeta, pdf=pdf,
                      volumen=volumen if volumen is not None else previo.get('volumen'))
    else:
        actual = previo
    if not actual.get('carpeta') or not actual.get('pdf'):
        raise SystemExit('ERROR: actual.json incompleto (faltan carpeta o pdf)')
    if not (raiz / actual['carpeta'] / actual['pdf']).is_file():
        raise SystemExit(f'ERROR: no existe {actual["carpeta"]}/{actual["pdf"]}')
    if not (raiz / actual['carpeta'] / 'data.json').is_file():
        raise SystemExit(f'ERROR: no existe {actual["carpeta"]}/data.json')
    pagina = raiz / 'boletin.html'
    html_previo = pagina.read_text(encoding='utf-8')
    valores = calcular(raiz, actual)
    nuevo, faltan = sincronizar_html(html_previo, valores['textos'], valores['enlaces'])
    if faltan:
        raise SystemExit(f'ERROR: claves sin valor en boletin.html: {sorted(set(faltan))}')
    if carpeta:
        tmp_actual = ruta.with_suffix('.json.tmp')
        tmp_actual.write_text(json.dumps(actual, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        tmp_actual.replace(ruta)
    tmp_pagina = pagina.with_suffix('.html.tmp')
    tmp_pagina.write_text(nuevo, encoding='utf-8')
    tmp_pagina.replace(pagina)
    # La página de categorías sin pronóstico (alta_b44) repite las cifras impresas de la foto vigente.
    if (raiz / 'no_modelables.html').is_file():
        r = subprocess.run(['node', str(RAIZ / 'scripts/no_modelables_pagina.mjs'), '--root', str(raiz)],
                           capture_output=True, text=True)
        if r.returncode != 0:
            raise SystemExit('ERROR: no se pudo actualizar no_modelables.html: '
                             + ((r.stderr or r.stdout).strip() or 'sin detalle'))
    # Opción «Pronóstico» del radar: exploratorio, no validado, de las categorías sin release (alta_b44).
    if (raiz / 'assets/boletin/history/index.json').is_file():
        # Acumulados nacionales de las notas del boletín (sarampión, P. falciparum): se agrega el boletín de la foto.
        txt = raiz / actual['carpeta'] / 'boletin.txt'
        m = re.search(r'(\d{4})-w(\d{2})', actual['carpeta'])
        if txt.is_file() and m and (raiz / 'assets/boletin/history/notas_acumulados.json').is_file():
            r = subprocess.run(['node', str(RAIZ / 'scripts/radar_notas_acumulados.mjs'), '--root', str(raiz),
                                '--agrega', str(txt), '--boletin', f'{m.group(1)}_sem{m.group(2)}'],
                               capture_output=True, text=True)
            if r.returncode != 0:
                raise SystemExit('ERROR: no se pudieron leer los acumulados de las notas del boletín: '
                                 + ((r.stderr or r.stdout).strip() or 'sin detalle'))
        r = subprocess.run(['node', str(RAIZ / 'scripts/radar_pronostico_exploratorio.mjs'), '--root', str(raiz)],
                           capture_output=True, text=True)
        if r.returncode != 0:
            raise SystemExit('ERROR: no se pudo generar el pronóstico exploratorio del radar: '
                             + ((r.stderr or r.stdout).strip() or 'sin detalle'))


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--carpeta')
    ap.add_argument('--pdf')
    ap.add_argument('--volumen', type=int)
    ap.add_argument('--raiz', default=str(RAIZ))
    a = ap.parse_args(argv)
    if bool(a.carpeta) != bool(a.pdf):
        ap.error('--carpeta y --pdf van juntos')
    activar(Path(a.raiz).expanduser(), a.carpeta, a.pdf, a.volumen)
    print('boletin.html sincronizado con', ACTUAL)
    return 0


if __name__ == '__main__':
    sys.exit(main())
