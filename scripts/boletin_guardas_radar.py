"""Guardas acotadas de raíces públicas del sitio, provenancia de simbología y preflight Node."""
from __future__ import annotations

import copy
import os
import subprocess
from pathlib import Path

NODO_PREFLIGHT = """
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
try {
  const [textosPath, dirFoto, exigirVerif] = process.argv.slice(1);
  const m = await import(pathToFileURL(textosPath).href);
  const data = JSON.parse(readFileSync(resolve(dirFoto, 'data.json'), 'utf8'));
  const vPath = resolve(dirFoto, 'verification.json');
  const tieneVerif = existsSync(vPath);
  if ((exigirVerif === '1' || data?.myiasis?.reconciliation) && !tieneVerif) {
    throw new Error('verification.json ausente en la foto a validar');
  }
  const verif = tieneVerif ? JSON.parse(readFileSync(vPath, 'utf8')) : null;
  m.verificarMiasis(data, verif);
} catch (e) {
  process.stderr.write(String(e?.message || e) + '\\n');
  process.exit(1);
}
"""


def parece_raiz_sitio(candidato: Path) -> bool:
    """Un directorio parece raíz pública del sitio si contiene boletin.html y actual.json."""
    try:
        return (
            candidato.is_dir()
            and (candidato / 'boletin.html').is_file()
            and (candidato / 'assets' / 'boletin' / 'actual.json').is_file()
        )
    except OSError:
        return False


def _ancestros_candidatos(ruta: Path) -> list[Path]:
    """Ancestros léxicos y resueltos de `ruta` (sin recorrer el sistema de archivos global)."""
    exp = Path(ruta).expanduser()
    lex = Path(os.path.abspath(exp))
    res = exp.resolve()
    vistos: set[str] = set()
    out: list[Path] = []
    for cadena in ((lex, *lex.parents), (res, *res.parents)):
        for p in cadena:
            clave = str(p)
            if clave not in vistos:
                vistos.add(clave)
                out.append(p)
    return out


def _mismo_directorio(a: Path, b: Path) -> bool:
    try:
        if a.exists() and b.exists():
            return os.path.samefile(a, b)
    except OSError:
        return False
    return os.path.normcase(os.path.abspath(a)) == os.path.normcase(os.path.abspath(b))


def bajo_directorio(ruta: Path, base: Path) -> bool:
    """True si `ruta` (o su padre léxico/resuelto) cae bajo `base`, cubriendo symlinks y mayúsculas."""
    base_exp = Path(base).expanduser()
    bases = [Path(os.path.abspath(base_exp)), base_exp.resolve()]
    for cand in _ancestros_candidatos(ruta):
        for b in bases:
            if _mismo_directorio(cand, b):
                return True
            if cand.is_relative_to(b):
                return True
    return False


def en_cualquier_sitio_publico(ruta: Path, raiz_declarada: Path) -> bool:
    """True si `ruta` cae bajo `raiz_declarada` o bajo cualquier ancestro con marcadores del sitio."""
    if bajo_directorio(ruta, raiz_declarada):
        return True
    return any(parece_raiz_sitio(cand) for cand in _ancestros_candidatos(ruta))


def resolver_modulo_textos(raiz_sitio: Path, raiz_codigo: Path) -> Path:
    local = Path(raiz_sitio).expanduser().resolve() / 'assets' / 'boletin' / 'textos.mjs'
    if local.is_file():
        return local
    return Path(raiz_codigo).expanduser().resolve() / 'assets' / 'boletin' / 'textos.mjs'


def verificar_miasis_artefactos(
    raiz_sitio: Path, carpeta_foto: Path, raiz_codigo: Path, exigir_verification: bool = True,
) -> None:
    """Ejecuta `verificarMiasis(data, verification)` con Node antes de publicar o activar."""
    modulo = resolver_modulo_textos(raiz_sitio, raiz_codigo)
    r = subprocess.run(
        [
            'node', '--input-type=module', '-e', NODO_PREFLIGHT,
            str(modulo), str(Path(carpeta_foto).expanduser().resolve()),
            '1' if exigir_verification else '0',
        ],
        capture_output=True, text=True,
    )
    if r.returncode != 0:
        detalle = (r.stderr or r.stdout).strip() or 'verificarMiasis rechazó los artefactos'
        raise ValueError(detalle)


def heredar_simbologia(previa_meta: dict) -> tuple[dict, dict]:
    """Etiqueta como HEREDADO cuando se reutiliza la simbología de la foto inmediata anterior."""
    orig = previa_meta['symbols']
    periodo_prev = f"{previa_meta['year']}-W{int(previa_meta['week']):02d}"
    sha_prev = previa_meta['pdf_sha256']
    paginas_prev = list(orig.get('paginas', []))
    heredada = {
        'simbolos': copy.deepcopy(orig['simbolos']),
        'paginas': paginas_prev,
        'origen': 'HEREDADO',
        'heredada_de': {
            'periodo': periodo_prev,
            'pdf_sha256': sha_prev,
        },
    }
    aviso = {
        'tipo': 'simbologia_heredada',
        'origen': 'HEREDADO',
        'paginas': paginas_prev,
        'heredada_de': {'periodo': periodo_prev, 'pdf_sha256': sha_prev},
    }
    return heredada, aviso
