"""Pruebas focales de disposición nominal local y proyección pública en miasis (radar).

Cubre validación nominal local (`cargar_disposiciones`), proyección pública estrictamente técnica
con hashes SHA-256 (`aplicar_a_miasis` y `verification.json`), ausencia total de marcadores
privados/rutas/chat en artefactos públicos, invariancia sin `--discrepancias-fuente` (W42/W43) y
bloqueo de registros `solo_pruebas` / `TEST_ONLY`. Todo insumo aquí es sintético.
"""
from __future__ import annotations

import copy
import hashlib
import io
import json
import shutil
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

RAIZ = Path(__file__).resolve().parents[1]
W42 = RAIZ / 'assets/boletin/2026-w42'
W43_R1 = RAIZ / 'assets/boletin/2026-w43-r1'
PDF_W43 = W43_R1 / 'sem43.pdf'
SHA_W43 = (hashlib.sha256(PDF_W43.read_bytes()).hexdigest()
           if PDF_W43.exists()
           else hashlib.sha256(b'SYNTHETIC_W43_PDF_PLACEHOLDER').hexdigest())
SHA_EVIDENCIA_TEST = hashlib.sha256(b'TEST_ONLY_SYNTHETIC_DISPOSITION_FIXTURE').hexdigest()
HERRAMIENTAS = PDF_W43.exists() and all(shutil.which(t) for t in ('pdftotext', 'pdftoppm', 'tesseract'))

MARCADORES_PRIVADOS_SINTETICOS = (
    'SYNTHETIC_AUTHOR_PRIVATE_MARKER',
    'SYNTHETIC_CHAT_ACTA_LITERAL',
    '/Users/synthetic_priv/planes/acta_44.md',
    '/Users/synthetic_priv/planes/control_privado/ACTA_SYNTHETIC_NO_PUBLICABLE.md',
    '2026-11-15T21:14:09-06:00',
    '2026-11-15',
    'TEST_ONLY',
    '"decision"',
    '"autor"',
    '"texto_literal"',
    '"enlace_evidencia"',
    '"evidencia_sha256"',
    '"solo_pruebas"',
)

# Texto exacto del cuadro de miasis impreso en 2026_sem44.pdf (p. 81): 29 entidades, suma col 7
# = 830, Total impreso = 831, Chihuahua 0 (2025) + 2 (2026) != 1 (Total impreso).
P81_W44_TXT = """Vigilancia Epidemiológica Semana 44, 2026
  Estado notificante
  Casos Porcentaje Defunciones Casos Porcentaje Defunciones Confirmados Casos Porcentaje Defunciones
Aguascalientes        0   0.0%  0    4   0.6%  0   0    4   0.5%  0
Campeche              4   3.4%  0   11   1.5%  0   0   15   1.8%  0
Chiapas              90  76.9%  0   84  11.8%  0   1  174  20.9%  0
Chihuahua             0   0.0%  0    2   0.3%  0   1    1   0.1%  0
Ciudad de México      0   0.0%  0   12   1.7%  0   0   12   1.4%  0
Coahuila              0   0.0%  0    6   0.8%  0   0    6   0.7%  0
Colima                0   0.0%  0    5   0.7%  0   0    5   0.6%  0
Durango               0   0.0%  0    2   0.3%  0   0    2   0.2%  0
Guanajuato            0   0.0%  0   19   2.7%  0   0   19   2.3%  0
Guerrero              0   0.0%  0   46   6.4%  0   3   46   5.5%  0
Hidalgo               0   0.0%  0   31   4.3%  0   0   31   3.7%  0
Jalisco               0   0.0%  0    8   1.1%  0   0    8   1.0%  0
Estado de México      0   0.0%  0   15   2.1%  0   0   15   1.8%  0
Michoacán             0   0.0%  0    7   1.0%  0   0    7   0.8%  0
Morelos               0   0.0%  0   11   1.5%  0   2   11   1.3%  0
Nayarit               0   0.0%  0    7   1.0%  1   0    7   0.8%  1
Nuevo León            0   0.0%  0    5   0.7%  0   1    5   0.6%  0
Oaxaca                4   3.4%  0   70   9.8%  2   0   74   8.9%  2
Puebla                0   0.0%  0   78  10.9%  1   0   78   9.4%  1
Querétaro             0   0.0%  0   10   1.4%  1   1   10   1.2%  1
Quintana Roo          6   5.1%  0   26   3.6%  1   0   32   3.9%  1
San Luis Potosí       0   0.0%  0   40   5.6%  0   0   40   4.8%  0
Sinaloa               0   0.0%  0    7   1.0%  0   1    7   0.8%  0
Tabasco               2   1.7%  0   12   1.7%  0   0   14   1.7%  0
Tamaulipas            0   0.0%  0    4   0.6%  0   0    4   0.5%  0
Tlaxcala              0   0.0%  0    3   0.4%  0   0    3   0.4%  0
Veracruz              1   0.9%  0  127  17.8%  2   0  128  15.4%  2
Yucatán              10   8.5%  0   50   7.0%  1   0   60   7.2%  1
Zacatecas             0   0.0%  0   12   1.7%  0   1   12   1.4%  0
Total de casos      117 100.0%  0  714 100.0%  9  11  831 100.0%  9
Durante la SE 15 del 2025 se confirmó el primer caso de Miasis por C. hominivorax en México.
Fuente: SINAVE/DVEET/ Sistema especial de vigilancia epidemiológica de miasis por C. hominivorax. *Fecha de corte: 13 de noviembre de 2026
"""


def disposicion_sintetica(pdf_sha256: str = SHA_W43, pagina: int = 86, **cambios) -> dict:
    """Construye un documento local sintético marcado TEST_ONLY con metadatos privados ficticios."""
    registro = {
        'pdf_sha256': pdf_sha256,
        'pagina': pagina,
        'cuadro': 'miasis',
        'columna': 7,
        'nombre_columna': 'Casos 2025–2026',
        'suma_estados': 830,
        'total_impreso': 831,
        'delta': 1,
        'filas_con_identidad_rota': [
            {'estado': 'Chihuahua', 'col0': 0, 'col3': 2, 'col7_impreso': 1},
        ],
        'estado': 'NO_RECONCILIADO',
        'celdas_modificadas': 0,
        'decision': {
            'autor': 'TEST_ONLY SYNTHETIC_AUTHOR_PRIVATE_MARKER',
            'fecha': '2026-11-15',
            'texto_literal': (
                'TEST_ONLY SYNTHETIC_CHAT_ACTA_LITERAL 2026-11-15T21:14:09-06:00 '
                '/Users/synthetic_priv/planes/acta_44.md'
            ),
            'enlace_evidencia': '/Users/synthetic_priv/planes/control_privado/ACTA_SYNTHETIC_NO_PUBLICABLE.md',
            'evidencia_sha256': SHA_EVIDENCIA_TEST,
            'solo_pruebas': True,
        },
    }
    registro.update(cambios)
    return {'schema': 'boletin_discrepancias_fuente.v1', 'discrepancias': [registro]}


def correr_gen(*args) -> tuple[int, str, str]:
    out, err = io.StringIO(), io.StringIO()
    with redirect_stdout(out), redirect_stderr(err):
        rc = gen.main(list(args))
    return rc, out.getvalue(), err.getvalue()


def texto_w43_con_miasis_rota() -> bytes:
    paginas = (W43_R1 / 'boletin.txt').read_bytes().decode('utf-8', 'replace').split('\f')
    paginas[85] = P81_W44_TXT  # página 86 (índice 0-based = 85)
    return '\f'.join(paginas).encode('utf-8')


class DiscrepanciasFuenteMiasis(unittest.TestCase):
    def assertSinMarcadoresPrivados(self, texto: str, contexto: str = '') -> None:
        for marcador in MARCADORES_PRIVADOS_SINTETICOS:
            self.assertNotIn(marcador, texto, f'{contexto} filtró marcador privado: {marcador}')

    def test_py1_miasis_reporta_detalle_exacto_y_conserva_celdas_impresas(self):
        problemas: list = []
        tabla = extrae.miasis(81, P81_W44_TXT, 2026, problemas)
        self.assertIsNotNone(tabla)
        self.assertEqual(len(tabla['states']), 29)
        chih = next(s for s in tabla['states'] if s['state'] == 'Chihuahua')
        self.assertEqual([chih['values'][0], chih['values'][3], chih['values'][7]], [0.0, 2.0, 1.0])
        self.assertEqual(tabla['totals'][7], 831)
        self.assertEqual(problemas, [{
            'pagina': 81,
            'tipo': 'miasis_reconciliacion',
            'cuadro': 'miasis',
            'columna': 7,
            'nombre_columna': 'Casos 2025–2026',
            'suma_estados': 830,
            'total_impreso': 831,
            'delta': 1,
            'filas_con_identidad_rota': [
                {'estado': 'Chihuahua', 'col0': 0, 'col3': 2, 'col7_impreso': 1},
            ],
        }])

    @unittest.skipUnless(HERRAMIENTAS, 'requiere sem43.pdf, pdftotext, pdftoppm y tesseract')
    def test_py2_sin_archivo_falla_y_con_disposicion_proyecta_solo_tecnico_y_hashes(self):
        ocr_cache = {int(k): v for k, v in json.loads((W43_R1 / 'encabezados-ocr.json').read_text()).items()}
        texto_roto = texto_w43_con_miasis_rota()
        with tempfile.TemporaryDirectory(prefix='radar-disp-') as tmpdir:
            tmp = Path(tmpdir)
            base_args = [
                '--pdf', str(PDF_W43),
                '--url-fuente', 'https://www.gob.mx/cms/uploads/attachment/file/1115232/sem43.pdf',
                '--publicacion', '2026-11-09',
                '--comprobado', '2026-11-16',
                '--anterior', str(W43_R1),
                '--sin-activar', '--sin-historia',
            ]
            with patch.object(extrae, 'texto_layout', return_value=texto_roto), \
                 patch.object(extrae, 'ocr_encabezados', return_value=ocr_cache):
                rc0, _, err0 = correr_gen(*base_args, '--salida', str(tmp / 'sin-disp'))
                self.assertEqual(rc0, 1)
                self.assertFalse((tmp / 'sin-disp').exists())
                self.assertIn('miasis_reconciliacion', err0)
                self.assertIn('830', err0)
                self.assertIn('Chihuahua', err0)

                disp_path = tmp / 'disp_local_privada.json'
                disp_bytes = json.dumps(disposicion_sintetica(), ensure_ascii=False, indent=2).encode('utf-8')
                disp_path.write_bytes(disp_bytes)
                disp_sha = hashlib.sha256(disp_bytes).hexdigest()

                rc1, _, err1 = correr_gen(
                    *base_args, '--salida', str(tmp / 'con-disp'),
                    '--discrepancias-fuente', str(disp_path),
                )
                self.assertEqual(rc1, 0, err1)
                archivos_salida = sorted(p.name for p in (tmp / 'con-disp').iterdir())
                self.assertEqual(
                    archivos_salida,
                    ['boletin.txt', 'catalogo.csv', 'data.json', 'encabezados-ocr.json', 'sem43.pdf', 'verification.json'],
                )
                data_txt = (tmp / 'con-disp/data.json').read_text(encoding='utf-8')
                verif_txt = (tmp / 'con-disp/verification.json').read_text(encoding='utf-8')
                csv_txt = (tmp / 'con-disp/catalogo.csv').read_text(encoding='utf-8')
                self.assertSinMarcadoresPrivados(data_txt, 'data.json')
                self.assertSinMarcadoresPrivados(verif_txt, 'verification.json')
                self.assertSinMarcadoresPrivados(csv_txt, 'catalogo.csv')

                datos = json.loads(data_txt)
                verif = json.loads(verif_txt)
                esperada = {
                    'pdf_sha256': SHA_W43,
                    'pagina': 86,
                    'cuadro': 'miasis',
                    'columna': 7,
                    'nombre_columna': 'Casos 2025–2026',
                    'suma_estados': 830,
                    'total_impreso': 831,
                    'delta': 1,
                    'filas_con_identidad_rota': [
                        {'estado': 'Chihuahua', 'col0': 0, 'col3': 2, 'col7_impreso': 1},
                    ],
                    'estado': 'NO_RECONCILIADO',
                    'celdas_modificadas': 0,
                    'authorization_sha256': SHA_EVIDENCIA_TEST,
                    'disposition_file_sha256': disp_sha,
                }
                chih = next(s for s in datos['myiasis']['states'] if s['state'] == 'Chihuahua')
                self.assertEqual(chih['values'][7], 1.0)
                self.assertEqual(datos['myiasis']['totals'][7], 831)
                self.assertEqual(datos['meta']['myiasis_status'], 'NO_RECONCILIADO')
                self.assertEqual(datos['myiasis']['reconciliation'], {
                    'status': 'NO_RECONCILIADO',
                    'columnas_ok': [0, 2, 3, 5, 6, 9],
                    'discrepancias': [esperada],
                })
                self.assertIs(verif['myiasis_reconciled'], False)
                self.assertTrue(verif['state_columns_reconciled'])
                self.assertEqual(verif['source_discrepancies'], [esperada])

    def test_py3_proyeccion_elimina_metadatos_privados_y_rechaza_negativos(self):
        problemas_base: list = []
        tabla_base = extrae.miasis(86, P81_W44_TXT, 2026, problemas_base)
        self.assertEqual(len(problemas_base), 1)

        with tempfile.NamedTemporaryFile('wb', suffix='.json') as f:
            crudo = json.dumps(disposicion_sintetica(), ensure_ascii=False).encode('utf-8')
            f.write(crudo)
            f.flush()
            cargadas = bdf.cargar_disposiciones(Path(f.name), SHA_W43)
            self.assertTrue(cargadas['tiene_solo_pruebas'])
            self.assertIn('decision', cargadas['registros'][0])
            tabla_ok = copy.deepcopy(tabla_base)
            restantes_ok = bdf.aplicar_a_miasis(tabla_ok, copy.deepcopy(problemas_base), cargadas)
            self.assertEqual(restantes_ok, [])
            serializado = json.dumps(tabla_ok, ensure_ascii=False)
            self.assertSinMarcadoresPrivados(serializado, 'tabla proyectada')
            disc = tabla_ok['reconciliation']['discrepancias'][0]
            self.assertEqual(set(disc.keys()), set(bdf.CLAVES_PROYECCION_PUBLICA))
            self.assertEqual(disc['authorization_sha256'], SHA_EVIDENCIA_TEST)
            self.assertEqual(disc['disposition_file_sha256'], hashlib.sha256(crudo).hexdigest())

            # Incluso en un fallo disposicion_no_coincide, el error estructurado no filtra decision.
            prob_alterado = copy.deepcopy(problemas_base)
            prob_alterado[0]['total_impreso'] = 832
            prob_alterado[0]['delta'] = 2
            err_no_coincide = bdf.aplicar_a_miasis(copy.deepcopy(tabla_base), prob_alterado, cargadas)
            self.assertEqual(err_no_coincide[0]['tipo'], 'disposicion_no_coincide')
            self.assertSinMarcadoresPrivados(json.dumps(err_no_coincide, ensure_ascii=False), 'error no_coincide')

        casos_invalidos = [
            disposicion_sintetica(pdf_sha256='a' * 64),
            disposicion_sintetica(pdf_sha256=SHA_W43[:40]),
            disposicion_sintetica(pagina=81),
            disposicion_sintetica(columna=3, nombre_columna='Casos 2026'),
            disposicion_sintetica(suma_estados=829, delta=2),
            disposicion_sintetica(filas_con_identidad_rota=[
                {'estado': 'Sonora', 'col0': 0, 'col3': 2, 'col7_impreso': 1},
            ]),
            disposicion_sintetica(filas_con_identidad_rota=[
                {'estado': 'Chihuahua', 'col0': 0, 'col3': 2, 'col7_impreso': 2},
            ]),
            disposicion_sintetica(celdas_modificadas=1),
            disposicion_sintetica(estado='PASS'),
            disposicion_sintetica(tolerancia=1),
        ]
        decision_incompleta = disposicion_sintetica()
        decision_incompleta['discrepancias'][0]['decision'] = {
            'autor': '<nombre del autor>',
            'fecha': '2026-11-16',
            'texto_literal': '',
            'enlace_evidencia': '',
            'evidencia_sha256': '1234',
        }
        casos_invalidos.append(decision_incompleta)
        for idx, doc in enumerate(casos_invalidos):
            with self.subTest(caso=idx), tempfile.NamedTemporaryFile('w', suffix='.json', encoding='utf-8') as f:
                json.dump(doc, f, ensure_ascii=False)
                f.flush()
                problemas = copy.deepcopy(problemas_base)
                tabla = copy.deepcopy(tabla_base)
                try:
                    cargadas = bdf.cargar_disposiciones(Path(f.name), SHA_W43)
                    restantes = bdf.aplicar_a_miasis(tabla, problemas, cargadas)
                except ValueError:
                    continue
                self.assertTrue(len(restantes) > 0, f'caso {idx} no debió reconciliar')

        with self.assertRaises(bdf.ErrorDisposicion):
            bdf.proyectar_discrepancia_publica(disposicion_sintetica()['discrepancias'][0], 'bad_sha')

    @unittest.skipUnless(PDF_W43.exists() and shutil.which('pdftotext'), 'requiere sem43.pdf y pdftotext')
    def test_py4_disposicion_sobrante_en_pdf_que_si_reconcilia_falla_cerrado(self):
        with tempfile.TemporaryDirectory(prefix='radar-sobrante-') as tmpdir:
            tmp = Path(tmpdir)
            disp_path = tmp / 'sobrante.json'
            disp_path.write_text(json.dumps(disposicion_sintetica(), ensure_ascii=False), encoding='utf-8')
            rc, _, err = correr_gen(
                '--pdf', str(PDF_W43),
                '--url-fuente', 'https://www.gob.mx/cms/uploads/attachment/file/1115232/sem43.pdf',
                '--publicacion', '2026-11-09',
                '--comprobado', '2026-11-16',
                '--anterior', str(W43_R1),
                '--salida', str(tmp / 'no-debe-existir'),
                '--discrepancias-fuente', str(disp_path),
                '--sin-activar', '--sin-historia',
            )
            self.assertEqual(rc, 1)
            self.assertIn('disposicion_sobrante', err)
            self.assertFalse((tmp / 'no-debe-existir').exists())

    @unittest.skipUnless(PDF_W43.exists(), 'requiere sem43.pdf')
    def test_py5_disposicion_para_bloque_estatal_o_resumen_nacional_falla_cerrado(self):
        for cuadro in ('estatal', 'p70b1', 'nacional', 'resumen_nacional'):
            with self.subTest(cuadro=cuadro), tempfile.TemporaryDirectory(prefix='radar-ambito-') as tmpdir:
                tmp = Path(tmpdir)
                disp_path = tmp / 'ambito.json'
                disp_path.write_text(
                    json.dumps(disposicion_sintetica(cuadro=cuadro), ensure_ascii=False),
                    encoding='utf-8',
                )
                rc, _, err = correr_gen(
                    '--pdf', str(PDF_W43),
                    '--url-fuente', 'https://www.gob.mx/cms/uploads/attachment/file/1115232/sem43.pdf',
                    '--publicacion', '2026-11-09',
                    '--anterior', str(W43_R1),
                    '--salida', str(tmp / 'no-debe-existir'),
                    '--discrepancias-fuente', str(disp_path),
                    '--sin-activar', '--sin-historia',
                )
                self.assertEqual(rc, 1)
                self.assertIn('disposicion_ambito_prohibido', err)
                self.assertFalse((tmp / 'no-debe-existir').exists())

    @unittest.skipUnless(PDF_W43.exists(), 'requiere sem43.pdf')
    def test_py6_test_only_y_ruta_en_assets_no_son_publicables(self):
        with tempfile.TemporaryDirectory(prefix='radar-testonly-') as tmpdir:
            tmp = Path(tmpdir)
            disp_path = tmp / 'test_only.json'
            disp_path.write_text(json.dumps(disposicion_sintetica(), ensure_ascii=False), encoding='utf-8')
            rc, _, err = correr_gen(
                '--pdf', str(PDF_W43),
                '--url-fuente', 'https://www.gob.mx/cms/uploads/attachment/file/1115232/sem43.pdf',
                '--publicacion', '2026-11-09',
                '--anterior', str(W43_R1),
                '--salida', str(tmp / 'no-debe-existir'),
                '--discrepancias-fuente', str(disp_path),
                '--sin-historia',  # falta --sin-activar -> debe fallar antes de tocar nada
            )
            self.assertEqual(rc, 1)
            self.assertIn('solo_pruebas', err)
            self.assertFalse((tmp / 'no-debe-existir').exists())

            # Si el archivo privado vive dentro de assets/ del sitio simulado, se rechaza cerrado.
            raiz_falsa = tmp / 'sitio'
            (raiz_falsa / 'assets/boletin').mkdir(parents=True)
            disp_en_assets = raiz_falsa / 'assets/disp_privada.json'
            disp_en_assets.write_text(json.dumps(disposicion_sintetica(), ensure_ascii=False), encoding='utf-8')
            rc_assets, _, err_assets = correr_gen(
                '--raiz', str(raiz_falsa),
                '--pdf', str(PDF_W43),
                '--url-fuente', 'https://www.gob.mx/cms/uploads/attachment/file/1115232/sem43.pdf',
                '--publicacion', '2026-11-09',
                '--anterior', str(W43_R1),
                '--salida', str(tmp / 'tampoco-debe-existir'),
                '--discrepancias-fuente', str(disp_en_assets),
                '--sin-activar', '--sin-historia',
            )
            self.assertEqual(rc_assets, 1)
            self.assertIn('assets/', err_assets)

    @unittest.skipUnless(HERRAMIENTAS, 'requiere sem43.pdf, pdftotext, pdftoppm y tesseract')
    def test_py7_fuentes_w42_y_w43_sin_optin_permanecen_byte_iguales(self):
        for carpeta in (W42, W43_R1):
            if not carpeta.exists():
                continue
            datos_pub = json.loads((carpeta / 'data.json').read_text(encoding='utf-8'))
            verif_pub = json.loads((carpeta / 'verification.json').read_text(encoding='utf-8'))
            self.assertNotIn('myiasis_status', datos_pub['meta'])
            self.assertNotIn('reconciliation', datos_pub['myiasis'])
            self.assertNotIn('myiasis_reconciled', verif_pub)
            self.assertNotIn('source_discrepancies', verif_pub)
            copia_miasis = copy.deepcopy(datos_pub['myiasis'])
            self.assertEqual(bdf.aplicar_a_miasis(copia_miasis, [], None), [])
            self.assertEqual(
                json.dumps(copia_miasis, ensure_ascii=False, separators=(',', ':')),
                json.dumps(datos_pub['myiasis'], ensure_ascii=False, separators=(',', ':')),
            )

        ocr_cache = {int(k): v for k, v in json.loads((W43_R1 / 'encabezados-ocr.json').read_text()).items()}
        texto_w43 = (W43_R1 / 'boletin.txt').read_bytes()
        w43_pub = json.loads((W43_R1 / 'data.json').read_text(encoding='utf-8'))
        with tempfile.TemporaryDirectory(prefix='radar-w43-intacto-') as tmpdir:
            tmp = Path(tmpdir)
            with patch.object(extrae, 'texto_layout', return_value=texto_w43), \
                 patch.object(extrae, 'ocr_encabezados', return_value=ocr_cache):
                rc, _, err = correr_gen(
                    '--pdf', str(PDF_W43),
                    '--url-fuente', w43_pub['meta']['source_url'],
                    '--publicacion', '2026-11-09',
                    '--comprobado', '2026-11-11',
                    '--anterior', str(W43_R1),
                    '--salida', str(tmp / 'w43-sin-optin'),
                    '--sin-activar', '--sin-historia',
                )
            self.assertEqual(rc, 0, err)
            regen = json.loads((tmp / 'w43-sin-optin/data.json').read_text(encoding='utf-8'))
            regen_verif = json.loads((tmp / 'w43-sin-optin/verification.json').read_text(encoding='utf-8'))
            self.assertNotIn('myiasis_status', regen['meta'])
            self.assertNotIn('reconciliation', regen['myiasis'])
            self.assertNotIn('myiasis_reconciled', regen_verif)
            self.assertNotIn('source_discrepancies', regen_verif)
            self.assertEqual(regen['myiasis'], w43_pub['myiasis'])
            probs_w43: list = []
            directo = extrae.miasis(w43_pub['myiasis']['page'], texto_w43.decode('utf-8', 'replace').split('\f')[w43_pub['myiasis']['page'] - 1], 2026, probs_w43)
            self.assertEqual(probs_w43, [])
            self.assertEqual(
                json.dumps(regen['myiasis'], ensure_ascii=False, separators=(',', ':')),
                json.dumps(directo, ensure_ascii=False, separators=(',', ':')),
            )


if __name__ == '__main__':
    unittest.main()
