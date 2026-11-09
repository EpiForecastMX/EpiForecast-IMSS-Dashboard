"""Activa una foto semanal del radar: actual.json y el texto estático de boletin.html.

assets/boletin/actual.json es el único lugar que dice cuál foto está vigente; la página
lo lee al cargar. El HTML conserva además el texto ya rellenado (para lectura sin
JavaScript y para buscadores): este módulo lo recalcula con assets/boletin/textos.mjs,
la misma función que usa el navegador, de modo que ambos no pueden divergir.

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

RAIZ = Path(__file__).resolve().parents[1]
ACTUAL = 'assets/boletin/actual.json'

NODO = """
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const [raiz] = process.argv.slice(1);
const m = await import(pathToFileURL(raiz + '/assets/boletin/textos.mjs').href);
const leer = r => JSON.parse(readFileSync(raiz + '/' + r, 'utf8'));
const actual = leer('assets/boletin/actual.json');
const data = leer(actual.carpeta + '/data.json');
const historia = leer('assets/boletin/history/index.json');
process.stdout.write(JSON.stringify({ textos: m.textosRadar(data, actual, historia),
  enlaces: m.enlacesRadar(actual) }));
"""


def calcular(raiz: Path) -> dict:
    r = subprocess.run(['node', '--input-type=module', '-e', NODO, str(raiz)],
                       capture_output=True, text=True, check=True)
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
    ruta = raiz / ACTUAL
    actual = json.loads(ruta.read_text()) if ruta.exists() else {}
    if carpeta:
        actual = dict(schema='boletin_actual.v1', carpeta=carpeta, pdf=pdf,
                      volumen=volumen if volumen is not None else actual.get('volumen'))
        ruta.write_text(json.dumps(actual, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if not (raiz / actual['carpeta'] / actual['pdf']).exists():
        raise SystemExit(f'ERROR: no existe {actual["carpeta"]}/{actual["pdf"]}')
    valores = calcular(raiz)
    pagina = raiz / 'boletin.html'
    nuevo, faltan = sincronizar_html(pagina.read_text(), valores['textos'], valores['enlaces'])
    if faltan:
        raise SystemExit(f'ERROR: claves sin valor en boletin.html: {sorted(set(faltan))}')
    pagina.write_text(nuevo, encoding='utf-8')


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--carpeta')
    ap.add_argument('--pdf')
    ap.add_argument('--volumen', type=int)
    ap.add_argument('--raiz', default=str(RAIZ))
    a = ap.parse_args()
    if bool(a.carpeta) != bool(a.pdf):
        ap.error('--carpeta y --pdf van juntos')
    activar(Path(a.raiz), a.carpeta, a.pdf, a.volumen)
    print('boletin.html sincronizado con', ACTUAL)
    return 0


if __name__ == '__main__':
    sys.exit(main())
