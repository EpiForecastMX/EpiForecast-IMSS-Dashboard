"""Pruebas de seguimiento Fable N1, N2, N3 y N4 (100% sintéticas, sin omitir casos)."""
from __future__ import annotations

import copy
import hashlib
import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import boletin_discrepancias_fuente as bdf  # noqa: E402
import boletin_semana as gen  # noqa: E402
import boletin_semana_activa as activa  # noqa: E402
import boletin_semana_extrae as extrae  # noqa: E402
from test_boletin_fable_cli import (  # noqa: E402
    ENTIDADES_32,
    SHA_ACTA_DEC,
    SHA_PDF_SINT,
    disposicion_doc,
    leer_sintetico,
    previa_sintetica,
    tabla_miasis_rota,
)

HTML_MINIMO = """<!doctype html><html><head>
<meta property="og:description" content="base" data-radar-content="Categorías: {categorias}">
</head><body>
<span data-radar="semana">43</span>/<span data-radar="anio">2026</span>
<span data-radar="miasis_resumen">Miasis: 29 entidades listadas, sin rellenar las tres ausentes.</span>
<a data-radar-enlace="pdf" href="/assets/boletin/2026-w43-r1/sem43.pdf">PDF</a>
<a data-radar-enlace="datos" href="/assets/boletin/2026-w43-r1/data.json">JSON</a>
</body></html>
"""


def _texto_miasis_n1_vertical_ok_horizontal_rota() -> str:
    """Chihuahua 0 + 2 != 1, pero Total de casos = 830 == 829 + 1 (verticales cuadran)."""
    filas = [
        'Vigilancia Epidemiológica Semana 44, 2026',
        '  Estado notificante',
        '  Casos Porcentaje Defunciones Casos Porcentaje Defunciones Confirmados Casos Porcentaje Defunciones',
        'Aguascalientes        117 100.0%  0  712  99.7%  9  10  829  99.9%  9',
        'Chihuahua               0   0.0%  0    2   0.3%  0   1    1   0.1%  0',
        'Total de casos        117 100.0%  0  714 100.0%  9  11  830 100.0%  9',
        'Fuente: SINAVE/DVEET/ Miasis por C. hominivorax. *Fecha de corte: 13 de noviembre de 2026',
    ]
    return '\n'.join(filas) + '\n'


class FableN1N4GuardsTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory(prefix='fable-n1n4-')
        self.base = Path(self._tmp.name)
        self.raiz = self.base / 'Sitio_Principal'
        (self.raiz / 'assets/boletin/2026-w43-r1').mkdir(parents=True)
        (self.raiz / 'assets/boletin/history').mkdir(parents=True)
        src_assets = Path(__file__).resolve().parents[1] / 'assets/boletin'
        for mjs in src_assets.glob('*.mjs'):
            (self.raiz / 'assets/boletin' / mjs.name).write_bytes(mjs.read_bytes())
        (self.raiz / 'boletin.html').write_text(HTML_MINIMO, encoding='utf-8')
        prev = previa_sintetica()
        (self.raiz / 'assets/boletin/2026-w43-r1/data.json').write_text(
            json.dumps(prev, ensure_ascii=False), encoding='utf-8'
        )
        (self.raiz / 'assets/boletin/2026-w43-r1/verification.json').write_text(
            json.dumps({'schema': 'boletin_radar.v1', 'source_pdf_sha256': prev['meta']['pdf_sha256']}),
            encoding='utf-8',
        )
        (self.raiz / 'assets/boletin/2026-w43-r1/sem43.pdf').write_bytes(b'PDF_W43_SINT')
        (self.raiz / 'assets/boletin/actual.json').write_text(
            json.dumps({'schema': 'boletin_actual.v1', 'carpeta': 'assets/boletin/2026-w43-r1',
                        'pdf': 'sem43.pdf', 'volumen': 43}, indent=2) + '\n',
            encoding='utf-8',
        )
        (self.raiz / 'assets/boletin/history/index.json').write_text(
            json.dumps({'checked': '2026-11-11', 'sources': [{'year': 2026, 'week': 43, 'sha256': prev['meta']['pdf_sha256']}]}),
            encoding='utf-8',
        )
        self.externo = self.base / 'externo_privado'
        self.externo.mkdir()
        self.pdf = self.externo / 'sem44.pdf'
        self.pdf.write_bytes(b'SYNTHETIC_PDF_BYTES_W44_GUARD_TEST')

    def tearDown(self):
        self._tmp.cleanup()

    def _correr_gen(self, *extra_args, leer_fn=leer_sintetico) -> tuple[int, str, str]:
        args = [
            '--raiz', str(self.raiz),
            '--pdf', str(self.pdf),
            '--url-fuente', 'https://www.gob.mx/cms/uploads/attachment/file/999/sem44.pdf',
            '--publicacion', '2026-11-15',
            '--comprobado', '2026-11-16',
            *extra_args,
        ]
        out, err = io.StringIO(), io.StringIO()
        with patch.object(extrae, 'texto_layout', return_value=b'Boletin Semana 44, 2026 Volumen 43'), \
             patch.object(extrae, 'leer', side_effect=leer_fn), \
             patch.object(extrae, 'ocr_encabezados', return_value={}), \
             patch.object(gen.cortes, 'semanas_validas', return_value={(2026, 44), (2026, 43)}), \
             patch.object(gen.cortes, 'corte', return_value=(44, 2026)), \
             patch.object(gen.cortes, 'texto_corte', return_value='Semana 44, 2026'), \
             redirect_stdout(out), redirect_stderr(err):
            rc = gen.main(args)
        return rc, out.getvalue(), err.getvalue()

    def test_n1_horizontal_rota_con_verticales_coherentes_falla_cerrado(self):
        probs: list = []
        tabla = extrae.miasis(81, _texto_miasis_n1_vertical_ok_horizontal_rota(), 2026, probs)
        self.assertIsNotNone(tabla)
        self.assertTrue(
            any(p.get('tipo') == 'miasis_identidad_horizontal_rota' for p in probs),
            f'Python debió detectar fila horizontal rota aunque sumen verticales: {probs}',
        )
        # Aunque un caller construyera una foto sin reportar problema en Python, el preflight Node
        # de boletin_semana también la rechaza antes de escribir destino o activar.
        def leer_n1_bypass(_pdf, _anio, _texto=None, disposiciones=None):
            res = leer_sintetico(_pdf, _anio, _texto, disposiciones=None)
            pass  # unreachable if leer_sintetico fails, so build directly:
        prev = previa_sintetica()
        d = prev['diseases'][0]
        tabla_n1, _ = tabla_miasis_rota(81)
        tabla_n1['totals'][7] = 830  # verticales coherentes (829 + 1 == 830), Chihuahua 0 + 2 != 1

        def leer_forzado_n1(_pdf, _anio, _texto=None, disposiciones=None):
            return {
                'estatales': [{'nombre': d['name'], 'codigo': d['code'], 'page': 14, 'columns': d['columns'],
                               'totals': d['totals'], 'states': d['states'], 'weekly': 1, 'cumulative': 10,
                               'previous': 8, 'anio_observado': 2026, 'estadios': False}],
                'nacionales': prev['national'], 'miasis': copy.deepcopy(tabla_n1),
                'paginas_estatales': [14], 'rotulos_nacionales': ['2026', '2026', '2021-2025', '2025', '2025'],
                'titulos': {14: 'CUADRO 3.1 Casos hasta la semana epidemiológica 44 del 2026'},
                'simbologia': prev['meta']['symbols'],
            }

        sha_ptr_antes = hashlib.sha256((self.raiz / 'assets/boletin/actual.json').read_bytes()).hexdigest()
        sha_html_antes = hashlib.sha256((self.raiz / 'boletin.html').read_bytes()).hexdigest()
        salida_n1 = self.externo / 'salida_n1'
        rc, _, err = self._correr_gen('--salida', str(salida_n1), '--sin-activar', '--sin-historia', leer_fn=leer_forzado_n1)
        self.assertEqual(rc, 1, f'Debió abortar antes del rename: {err}')
        self.assertFalse(salida_n1.exists())
        self.assertEqual(hashlib.sha256((self.raiz / 'assets/boletin/actual.json').read_bytes()).hexdigest(), sha_ptr_antes)
        self.assertEqual(hashlib.sha256((self.raiz / 'boletin.html').read_bytes()).hexdigest(), sha_html_antes)

    def test_n2_activador_y_generador_validan_antes_de_mutar_puntero_html_o_destino(self):
        mal_dir = self.raiz / 'assets/boletin/SYNTHETIC_BAD_NOT_SOURCE'
        mal_dir.mkdir(parents=True)
        mal_data = previa_sintetica()
        mal_data['meta']['week'] = 44
        next(s for s in mal_data['myiasis']['states'] if s['state'] == 'Chihuahua')['values'][7] = 1.0
        mal_data['myiasis']['totals'][7] = 830
        (mal_dir / 'data.json').write_text(json.dumps(mal_data), encoding='utf-8')
        (mal_dir / 'boletin-4426.pdf').write_bytes(b'PDF_BAD_SINT')

        ptr_bytes_antes = (self.raiz / 'assets/boletin/actual.json').read_bytes()
        html_bytes_antes = (self.raiz / 'boletin.html').read_bytes()

        with self.assertRaises(SystemExit) as ctx:
            activa.activar(self.raiz, 'assets/boletin/SYNTHETIC_BAD_NOT_SOURCE', 'boletin-4426.pdf', 43)
        self.assertIn('ERROR:', str(ctx.exception))
        self.assertEqual((self.raiz / 'assets/boletin/actual.json').read_bytes(), ptr_bytes_antes)
        self.assertEqual((self.raiz / 'boletin.html').read_bytes(), html_bytes_antes)

        # También si miasis declara reconciliation sin verification.json o con privada filtrada:
        con_priv = copy.deepcopy(mal_data)
        con_priv['meta']['myiasis_status'] = 'NO_RECONCILIADO'
        con_priv['myiasis']['totals'][7] = 831
        con_priv['myiasis']['reconciliation'] = {
            'status': 'NO_RECONCILIADO', 'columnas_ok': [0, 2, 3, 5, 6, 9],
            'discrepancias': [{'decision': {'autor': 'PRIVADO'}}],
        }
        (mal_dir / 'data.json').write_text(json.dumps(con_priv), encoding='utf-8')
        with self.assertRaises(SystemExit):
            activa.activar(self.raiz, 'assets/boletin/SYNTHETIC_BAD_NOT_SOURCE', 'boletin-4426.pdf', 43)
        self.assertEqual((self.raiz / 'assets/boletin/actual.json').read_bytes(), ptr_bytes_antes)
        self.assertEqual((self.raiz / 'boletin.html').read_bytes(), html_bytes_antes)

        # Foto válida sí activa y actualiza puntero + HTML:
        ok_dir = self.raiz / 'assets/boletin/2026-w44'
        ok_dir.mkdir(parents=True)
        ok_data = previa_sintetica()
        ok_data['meta']['week'] = 44
        (ok_dir / 'data.json').write_text(json.dumps(ok_data), encoding='utf-8')
        (ok_dir / 'verification.json').write_text(
            json.dumps({'schema': 'boletin_radar.v1', 'source_pdf_sha256': ok_data['meta']['pdf_sha256']}),
            encoding='utf-8',
        )
        (ok_dir / 'boletin-4426.pdf').write_bytes(b'PDF_OK_SINT')
        activa.activar(self.raiz, 'assets/boletin/2026-w44', 'boletin-4426.pdf', 43)
        self.assertEqual(json.loads((self.raiz / 'assets/boletin/actual.json').read_text())['carpeta'], 'assets/boletin/2026-w44')
        self.assertIn('<span data-radar="semana">44</span>', (self.raiz / 'boletin.html').read_text(encoding='utf-8'))

    def test_n3_protege_otras_raices_publicas_marcadores_mayusculas_y_symlinks(self):
        otro_sitio = self.base / 'Otro_Sitio_Real'
        (otro_sitio / 'assets/boletin').mkdir(parents=True)
        (otro_sitio / 'boletin.html').write_text('<!doctype html>', encoding='utf-8')
        (otro_sitio / 'assets/boletin/actual.json').write_text('{}', encoding='utf-8')

        disp_ext = self.externo / 'disp_test_only.json'
        disp_ext.write_text(json.dumps(disposicion_doc()), encoding='utf-8')

        # 1) Salida TEST_ONLY hacia OTRO sitio (distinto de --raiz) -> bloqueada.
        dest_otro = otro_sitio / 'assets/boletin/2026-w44'
        rc1, _, err1 = self._correr_gen(
            '--salida', str(dest_otro), '--discrepancias-fuente', str(disp_ext),
            '--sin-activar', '--sin-historia',
        )
        self.assertEqual(rc1, 1, err1)
        self.assertFalse(dest_otro.exists())

        # 2) Input privado guardado dentro de OTRO sitio -> bloqueado antes de leer.
        disp_en_otro = otro_sitio / 'planes/disp.json'
        disp_en_otro.parent.mkdir(parents=True)
        disp_en_otro.write_text(json.dumps(disposicion_doc()), encoding='utf-8')
        rc2, _, _ = self._correr_gen(
            '--salida', str(self.externo / 'out_n3_2'), '--discrepancias-fuente', str(disp_en_otro),
            '--sin-activar', '--sin-historia',
        )
        self.assertEqual(rc2, 1)
        self.assertFalse((self.externo / 'out_n3_2').exists())

        # 3) Enlace simbólico externo que apunta dentro de otro_sitio -> bloqueado.
        enlace = self.externo / 'link_hacia_sitio'
        os.symlink(otro_sitio / 'assets', enlace)
        rc3, _, _ = self._correr_gen(
            '--salida', str(enlace / 'prueba-w44'), '--discrepancias-fuente', str(disp_ext),
            '--sin-activar', '--sin-historia',
        )
        self.assertEqual(rc3, 1)
        self.assertFalse((otro_sitio / 'assets/prueba-w44').exists())

        # 4) Si el sistema de archivos es insensible a mayúsculas (APFS), ruta con otra capitalización -> bloqueada.
        alt_case = self.base / 'sitio_principal'
        if alt_case.exists() and os.path.samefile(alt_case, self.raiz):
            rc4, _, _ = self._correr_gen(
                '--salida', str(alt_case / 'w44-case-bypass'), '--discrepancias-fuente', str(disp_ext),
                '--sin-activar', '--sin-historia',
            )
            self.assertEqual(rc4, 1)
            self.assertFalse((self.raiz / 'w44-case-bypass').exists())

    def test_n4_simbologia_heredada_etiqueta_origen_heredado_y_provenancia_inmediata(self):
        def leer_sin_simb(_pdf, _anio, _texto=None, disposiciones=None):
            res = leer_sintetico(_pdf, _anio, _texto, disposiciones=disposiciones)
            res['simbologia'] = None
            return res

        disp_ext = self.externo / 'disp_n4.json'
        disp_ext.write_text(json.dumps(disposicion_doc()), encoding='utf-8')
        salida = self.externo / 'out_n4'
        rc, _, err = self._correr_gen(
            '--salida', str(salida), '--discrepancias-fuente', str(disp_ext),
            '--sin-activar', '--sin-historia', leer_fn=leer_sin_simb,
        )
        self.assertEqual(rc, 0, err)
        datos = json.loads((salida / 'data.json').read_text(encoding='utf-8'))
        verif = json.loads((salida / 'verification.json').read_text(encoding='utf-8'))
        simb = datos['meta']['symbols']
        self.assertEqual(simb['origen'], 'HEREDADO')
        self.assertEqual(simb['heredada_de'], {'periodo': '2026-W43', 'pdf_sha256': 'b' * 64})
        self.assertEqual(simb['paginas'], [9, 10])
        self.assertEqual(simb['simbolos'], {'-': 'no se presentaron casos'})
        self.assertTrue(any(w.get('tipo') == 'simbologia_heredada' and w.get('origen') == 'HEREDADO'
                            for w in verif.get('warnings', [])))


if __name__ == '__main__':
    unittest.main()
