"""Pruebas CLI/generador (F1, F2, F8c, N5c) con insumos 100% sintéticos y helpers mockeados."""
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
import boletin_semana_extrae as extrae  # noqa: E402

ENTIDADES_32 = [
    'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Coahuila', 'Colima',
    'Chiapas', 'Chihuahua', 'Ciudad de México', 'Durango', 'Guanajuato', 'Guerrero', 'Hidalgo',
    'Jalisco', 'México', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla',
    'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas',
    'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
]
SHA_PDF_SINT = hashlib.sha256(b'SYNTHETIC_PDF_BYTES_W44_GUARD_TEST').hexdigest()
SHA_ACTA_DEC = hashlib.sha256(b'SYNTHETIC_DECLARED_EVIDENCE_ID').hexdigest()
MARCADORES_PRIV = (
    'SYNTHETIC_AUTHOR_PRIVATE_MARKER', 'SYNTHETIC_CHAT_ACTA_LITERAL',
    '/Users/synthetic_priv/planes/acta_44.md', '2026-11-15T21:14:09-06:00', 'TEST_ONLY',
    '"decision"', '"autor"', '"texto_literal"', '"enlace_evidencia"', '"evidencia_sha256"', '"solo_pruebas"',
)


def tabla_miasis_rota(pagina: int = 81) -> tuple[dict, list[dict]]:
    presentes = [e for e in ENTIDADES_32 if e not in ('Baja California', 'Baja California Sur', 'Sonora')]
    filas = []
    for idx, est in enumerate(presentes):
        nombre = 'Estado de México' if est == 'México' else est
        if est == 'Chihuahua':
            vals = [0.0, 0.0, 0.0, 2.0, 0.3, 0.0, 1.0, 1.0, 0.1, 0.0]
        elif idx == 0:
            vals = [117.0, 100.0, 0.0, 712.0, 99.7, 9.0, 10.0, 829.0, 99.9, 9.0]
        else:
            vals = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
        filas.append({'state': nombre, 'values': vals})
    totales = [117, 100, 0, 714, 100, 9, 11, 831, 100, 9]
    columnas = [
        'Casos 2025', '% 2025', 'Defunciones 2025', 'Casos 2026', '% 2026',
        'Defunciones 2026', 'Confirmados últimos 7 días', 'Casos 2025–2026',
        '% total', 'Defunciones totales',
    ]
    probs = []
    for k in bdf.COLUMNAS_CONTEO_MIASIS:
        p = bdf.construir_problema_miasis(pagina, k, columnas[k], filas, totales)
        if p is not None:
            probs.append(p)
    tabla = {
        'name': 'Miasis humana confirmada por Cochliomyia hominivorax',
        'page': pagina, 'cut': '13 de noviembre de 2026', 'columns': columnas,
        'totals': totales, 'states': filas, 'reclassified_to_discarded': None,
        'notes': ['*Fecha de corte: 13 de noviembre de 2026'],
    }
    return tabla, probs


def previa_sintetica() -> dict:
    states = [{'state': e, 'values': [1 if i == 0 else 0, 5 if i == 0 else 0, 5 if i == 0 else 0, 8 if i == 0 else 0]}
              for i, e in enumerate(ENTIDADES_32)]
    tabla_ok, _ = tabla_miasis_rota(86)
    next(s for s in tabla_ok['states'] if s['state'] == 'Chihuahua')['values'][7] = 2.0
    return {
        'meta': {
            'week': 43, 'year': 2026, 'period': '2–8 de noviembre de 2026',
            'publication': '9 de noviembre de 2026', 'checked': '11 de noviembre de 2026',
            'index_url': 'https://www.gob.mx/salud',
            'pdf_sha256': 'b' * 64, 'registry_sha256': 'c' * 64,
            'territorial_blocks': 1, 'national_rows': 1, 'categories': 1,
            'aggregate_rows': 0, 'platform_published': 0,
            'symbols': {'simbolos': {'-': 'no se presentaron casos'}, 'paginas': [9, 10]},
        },
        'diseases': [{
            'id': 'p14b1', 'name': 'Cólera', 'code': 'A00', 'page': 14, 'group': 'Intestinales',
            'columns': ['Sem.', 'H', 'M', 'Acum. 2025'], 'totals': [1, 5, 5, 8],
            'states': states, 'reconciled': True, 'state_count': 32,
            'weekly': 1, 'cumulative': 10, 'previous': 8,
            'aggregate': False, 'platform_id': None, 'status': 'Por incorporar',
            'source_note': '', 'observed_week': 43, 'cut_text': 'Semana 43',
            'variables': [], 'active_states': 1,
            'score_parts': {'carga': 5.0, 'afinidad': 10.0, 'dispersion': 0.78, 'crecimiento': 3.0},
            'score': None, 'reason': 'Sintético', 'priority': 'Exploración',
        }],
        'national': [{'page': 9, 'name': 'Cólera', 'code': 'A00', 'weekly': 1, 'cumulative': 10,
                      'median': 2, 'weekly_previous': 1, 'previous': 8}],
        'myiasis': tabla_ok,
    }


def disposicion_doc(solo_pruebas: bool = True, autor_prefix: str = 'TEST_ONLY ') -> dict:
    return {
        'schema': 'boletin_discrepancias_fuente.v1',
        'discrepancias': [{
            'pdf_sha256': SHA_PDF_SINT, 'pagina': 81, 'cuadro': 'miasis', 'columna': 7,
            'nombre_columna': 'Casos 2025–2026', 'suma_estados': 830, 'total_impreso': 831, 'delta': 1,
            'filas_con_identidad_rota': [{'estado': 'Chihuahua', 'col0': 0, 'col3': 2, 'col7_impreso': 1}],
            'estado': 'NO_RECONCILIADO', 'celdas_modificadas': 0,
            'decision': {
                'autor': f'{autor_prefix}SYNTHETIC_AUTHOR_PRIVATE_MARKER',
                'fecha': '2026-11-15',
                'texto_literal': 'SYNTHETIC_CHAT_ACTA_LITERAL 2026-11-15T21:14:09-06:00 /Users/synthetic_priv/planes/acta_44.md',
                'enlace_evidencia': '/Users/synthetic_priv/no_existe_acta.md',
                'evidencia_sha256': SHA_ACTA_DEC,
                'solo_pruebas': solo_pruebas,
            },
        }],
    }


def leer_sintetico(_pdf: Path, _anio: int, _texto: bytes | None = None, disposiciones: dict | None = None) -> dict:
    prev = previa_sintetica()
    d = prev['diseases'][0]
    tabla, probs_miasis = tabla_miasis_rota(81)
    errores = bdf.aplicar_a_miasis(tabla, probs_miasis, disposiciones)
    if errores:
        raise extrae.ErrorExtraccion(errores)
    return {
        'estatales': [{
            'nombre': d['name'], 'codigo': d['code'], 'page': 14, 'columns': d['columns'],
            'totals': d['totals'], 'states': d['states'], 'weekly': 1, 'cumulative': 10,
            'previous': 8, 'anio_observado': 2026, 'estadios': False,
        }],
        'nacionales': prev['national'],
        'miasis': tabla,
        'paginas_estatales': [14],
        'rotulos_nacionales': ['2026', '2026', '2021-2025', '2025', '2025'],
        'titulos': {14: 'CUADRO 3.1 Casos hasta la semana epidemiológica 44 del 2026'},
        'simbologia': prev['meta']['symbols'],
    }


class FableCliGuardsTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory(prefix='fable-cli-')
        self.base = Path(self._tmp.name)
        self.raiz = self.base / 'sitio_publico'
        (self.raiz / 'assets/boletin/2026-w43-r1').mkdir(parents=True)
        (self.raiz / 'boletin.html').write_text('<!doctype html><html></html>', encoding='utf-8')
        (self.raiz / 'assets/boletin/actual.json').write_text(
            json.dumps({'carpeta': 'assets/boletin/2026-w43-r1', 'pdf': 'sem43.pdf', 'volumen': 43}),
            encoding='utf-8',
        )
        (self.raiz / 'assets/boletin/2026-w43-r1/data.json').write_text(
            json.dumps(previa_sintetica()), encoding='utf-8'
        )
        self.externo = self.base / 'privado_externo'
        self.externo.mkdir()
        self.pdf = self.externo / 'sem44_sintetico.pdf'
        self.pdf.write_bytes(b'SYNTHETIC_PDF_BYTES_W44_GUARD_TEST')

    def tearDown(self):
        self._tmp.cleanup()

    def _correr(self, *extra_args, raiz: str | None = None, pdf: str | None = None) -> tuple[int, str, str]:
        args = [
            '--raiz', raiz or str(self.raiz),
            '--pdf', pdf or str(self.pdf),
            '--url-fuente', 'https://www.gob.mx/cms/uploads/attachment/file/999/sem44.pdf',
            '--publicacion', '2026-11-15',
            '--comprobado', '2026-11-16',
            *extra_args,
        ]
        out, err = io.StringIO(), io.StringIO()
        with patch.object(extrae, 'texto_layout', return_value=b'Boletin Semana 44, 2026 Volumen 43'), \
             patch.object(extrae, 'leer', side_effect=leer_sintetico), \
             patch.object(extrae, 'ocr_encabezados', return_value={}), \
             patch.object(gen.cortes, 'semanas_validas', return_value={(2026, 44), (2026, 43)}), \
             patch.object(gen.cortes, 'corte', return_value=(44, 2026)), \
             patch.object(gen.cortes, 'texto_corte', return_value='Semana 44, 2026'), \
             redirect_stdout(out), redirect_stderr(err):
            rc = gen.main(args)
        return rc, out.getvalue(), err.getvalue()

    def test_f1_rechaza_input_privado_bajo_cualquier_ruta_de_raiz_sitio(self):
        rutas_prohibidas = [
            self.raiz / 'disposicion_w44.json',
            self.raiz / 'planes/disposicion_w44.json',
            self.raiz / 'assets/disposicion_w44.json',
            self.raiz / 'assets/boletin/disposicion_w44.json',
        ]
        for idx, ruta in enumerate(rutas_prohibidas):
            with self.subTest(ruta=str(ruta.relative_to(self.raiz))):
                ruta.parent.mkdir(parents=True, exist_ok=True)
                ruta.write_text(json.dumps(disposicion_doc()), encoding='utf-8')
                salida = self.externo / f'out_f1_{idx}'
                rc, out, err = self._correr(
                    '--salida', str(salida), '--discrepancias-fuente', str(ruta),
                    '--sin-activar', '--sin-historia',
                )
                self.assertEqual(rc, 1, f'Debió rechazar {ruta}, stdout={out}, stderr={err}')
                self.assertIn('ERROR:', err)
                self.assertFalse(salida.exists())
                for m in MARCADORES_PRIV:
                    self.assertNotIn(m, out + err)

        salida_ext = self.externo / 'salida_con_input_adentro'
        salida_ext.mkdir(parents=True)
        en_salida = salida_ext / 'disp.json'
        en_salida.write_text(json.dumps(disposicion_doc()), encoding='utf-8')
        rc_sal, _, err_sal = self._correr(
            '--salida', str(salida_ext), '--reemplazar',
            '--discrepancias-fuente', str(en_salida), '--sin-activar', '--sin-historia',
        )
        self.assertEqual(rc_sal, 1)
        self.assertIn('ERROR:', err_sal)
        self.assertFalse((salida_ext / 'data.json').exists())

    def test_f2_test_only_prohibe_toda_salida_bajo_raiz_y_permite_externa_aislada(self):
        disp_solo = self.externo / 'disp_solo_pruebas.json'
        disp_solo.write_text(json.dumps(disposicion_doc(solo_pruebas=True, autor_prefix='')), encoding='utf-8')
        disp_marker = self.externo / 'disp_test_only_marker.json'
        disp_marker.write_text(json.dumps(disposicion_doc(solo_pruebas=False, autor_prefix='TEST_ONLY ')), encoding='utf-8')

        destinos_bajo_raiz = [
            self.raiz / 'assets/prueba-w44',
            self.raiz / 'w44-prueba',
            self.raiz / 'assets/boletin/2026-w44',
        ]
        for disp in (disp_solo, disp_marker):
            for dest in destinos_bajo_raiz:
                with self.subTest(disp=disp.name, dest=str(dest.relative_to(self.raiz))):
                    rc, _, err = self._correr(
                        '--salida', str(dest), '--discrepancias-fuente', str(disp),
                        '--sin-activar', '--sin-historia',
                    )
                    self.assertEqual(rc, 1, f'Debió bloquear salida bajo raíz: {dest}')
                    self.assertIn('ERROR:', err)
                    self.assertFalse(dest.exists())

        salida_ok = self.externo / 'salida_prueba_externa'
        for flag in ('--sin-historia', '--sin-activar'):
            rc_parcial, _, _ = self._correr('--salida', str(salida_ok), '--discrepancias-fuente', str(disp_solo), flag)
            self.assertEqual(rc_parcial, 1)
            self.assertFalse(salida_ok.exists())

        rc_ok, _, err_ok = self._correr(
            '--salida', str(salida_ok), '--discrepancias-fuente', str(disp_solo),
            '--sin-activar', '--sin-historia',
        )
        self.assertEqual(rc_ok, 0, err_ok)
        self.assertTrue((salida_ok / 'data.json').exists())
        for m in MARCADORES_PRIV:
            self.assertNotIn(m, (salida_ok / 'data.json').read_text(encoding='utf-8'))
            self.assertNotIn(m, (salida_ok / 'verification.json').read_text(encoding='utf-8'))

    def test_f8c_cargadas_malformadas_captura_error_disposicion_rc1_sin_traza_ni_escritura(self):
        disp_valida = self.externo / 'disp_valida.json'
        disp_valida.write_text(json.dumps(disposicion_doc()), encoding='utf-8')
        reg_valido = bdf.cargar_disposiciones(disp_valida, SHA_PDF_SINT)['registros'][0]
        malformadas = [
            {'registros': [copy.deepcopy(reg_valido)], 'tiene_solo_pruebas': True},
            {'file_sha256': 'no_es_sha', 'registros': [copy.deepcopy(reg_valido)], 'tiene_solo_pruebas': True},
            {'file_sha256': 'a' * 64, 'registros': [], 'tiene_solo_pruebas': True},
        ]
        for idx, cargada_rota in enumerate(malformadas):
            with self.subTest(caso=idx), patch.object(bdf, 'cargar_disposiciones', return_value=cargada_rota):
                salida = self.externo / f'out_f8c_{idx}'
                rc, _, err = self._correr(
                    '--salida', str(salida), '--discrepancias-fuente', str(disp_valida),
                    '--sin-activar', '--sin-historia',
                )
                self.assertEqual(rc, 1)
                self.assertIn('ERROR:', err)
                self.assertNotIn('Traceback', err)
                self.assertFalse(salida.exists())

    def test_n5c_expanduser_coherente_en_cli_y_guardas(self):
        disp_ext = self.externo / 'disp_tilde.json'
        disp_ext.write_text(json.dumps(disposicion_doc()), encoding='utf-8')
        with patch.dict(os.environ, {'HOME': str(self.base)}):
            rc_ok, _, err_ok = self._correr(
                '--salida', '~/privado_externo/out_tilde',
                '--discrepancias-fuente', '~/privado_externo/disp_tilde.json',
                '--sin-activar', '--sin-historia',
                raiz='~/sitio_publico', pdf='~/privado_externo/sem44_sintetico.pdf',
            )
            self.assertEqual(rc_ok, 0, err_ok)
            self.assertTrue((self.externo / 'out_tilde/data.json').is_file())


if __name__ == '__main__':
    unittest.main()
