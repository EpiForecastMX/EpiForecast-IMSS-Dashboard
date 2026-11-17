"""Pruebas de extracción, esquema, canonicalización, porcentajes y provenancia (P1, F3, F5, F6, F7, F8a, F8b, N5a/b)."""
from __future__ import annotations

import hashlib
import json
import sys
import tempfile
import unittest
import xml.etree.ElementTree as E
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import boletin_discrepancias_fuente as bdf  # noqa: E402
import boletin_semana_extrae as extrae  # noqa: E402

ENTIDADES_32 = [
    'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Coahuila', 'Colima',
    'Chiapas', 'Chihuahua', 'Ciudad de México', 'Durango', 'Guanajuato', 'Guerrero', 'Hidalgo',
    'Jalisco', 'México', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla',
    'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas',
    'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
]
SHA_PDF = hashlib.sha256(b'SYNTHETIC_PDF_DATOS_TEST').hexdigest()
SHA_ACTA = hashlib.sha256(b'SYNTHETIC_ACTA_DECLARADA').hexdigest()


def texto_miasis(total_col7: int = 830, chih_col7: str = '2', chih_col0: str = '0', pct_total: str = '100.0%') -> str:
    filas = [
        'Vigilancia Epidemiológica Semana 44, 2026',
        '  Estado notificante',
        '  Casos Porcentaje Defunciones Casos Porcentaje Defunciones Confirmados Casos Porcentaje Defunciones',
        'Aguascalientes        117 100.0%  0  711  99.7%  9  10  828  99.8%  9',
        f'Chihuahua             {chih_col0}   0.0%  0    2   0.3%  0   1   {chih_col7}   0.1%  0',
        f'Total de casos      117 100.0%  0  713 100.0%  9  11  {total_col7} {pct_total}  9',
        'Fuente: SINAVE/DVEET/ Miasis por C. hominivorax. *Fecha de corte: 13 de noviembre de 2026',
    ]
    return '\n'.join(filas) + '\n'


def xml_paginas_sinteticas(num_paginas_miasis: int) -> list[E.Element]:
    ns = 'http://www.w3.org/1999/xhtml'

    def mk_page() -> E.Element:
        return E.Element(f'{{{ns}}}page', {'width': '540', 'height': '720'})

    def add_line(page: E.Element, x: float, y: float, words: list[tuple[float, float, str]]) -> None:
        ln = E.SubElement(page, f'{{{ns}}}line', {
            'xMin': str(x), 'xMax': str(words[-1][1]), 'yMin': str(y), 'yMax': str(y + 8),
        })
        for wx0, wx1, txt in words:
            w = E.SubElement(ln, f'{{{ns}}}word', {
                'xMin': str(wx0), 'xMax': str(wx1), 'yMin': str(y), 'yMax': str(y + 8),
            })
            w.text = txt

    p_est = mk_page()
    add_line(p_est, 130, 75, [(130, 420, 'CUADRO 3.1 Casos hasta la semana epidemiológica 44 del 2026')])
    add_line(p_est, 160, 110, [(160, 220, 'Cólera')])
    add_line(p_est, 160, 130, [(160, 240, 'CIE-10ª'), (245, 290, 'REV.'), (295, 320, 'A00')])
    add_line(p_est, 180, 165, [(180, 210, '2026'), (290, 320, '2025')])
    add_line(p_est, 30, 195, [(30, 90, 'ENTIDAD')])
    add_line(p_est, 150, 195, [(150, 175, 'Sem.'), (205, 220, 'H'), (245, 260, 'M')])
    for idx, ent in enumerate(ENTIDADES_32):
        y = 225 + idx * 12
        v = '1' if idx == 0 else '0'
        add_line(p_est, 25, y, [(25, 110, ent)])
        add_line(p_est, 155, y, [(155, 170, v), (205, 220, v), (245, 260, v), (295, 310, v)])
    add_line(p_est, 25, 630, [(25, 80, 'TOTAL'), (155, 170, '1'), (205, 220, '1'), (245, 260, '1'), (295, 310, '1')])

    p_nac = mk_page()
    add_line(p_nac, 30, 100, [(30, 110, 'ENFERMEDAD')])
    add_line(p_nac, 180, 100, [(180, 220, 'CIE-10')])
    add_line(p_nac, 350, 95, [(350, 410, 'MEDIANA')])
    xs = [(250, 275, '2026'), (300, 325, '2026'), (350, 395, '2021-2025'), (420, 445, '2025'), (470, 495, '2025')]
    for x0, x1, t in xs:
        add_line(p_nac, x0, 112, [(x0, x1, t)])
    add_line(p_nac, 30, 150, [(30, 90, 'Cólera')])
    add_line(p_nac, 185, 150, [(185, 210, 'A00')])
    for x0, x1, _ in xs:
        add_line(p_nac, x1 - 10, 150, [(x1 - 10, x1, '1')])
    add_line(p_nac, 30, 660, [(30, 120, 'FUENTE: SINAVE')])

    paginas_miasis = []
    for k in range(num_paginas_miasis):
        pm = mk_page()
        add_line(pm, 30, 80, [(30, 220, f'Miasis pagina {k + 1}')])
        paginas_miasis.append(pm)
    return [p_est, p_nac, *paginas_miasis]


def registro_base(pagina: int = 3, **cambios) -> dict:
    reg = {
        'pdf_sha256': SHA_PDF, 'pagina': pagina, 'cuadro': 'miasis', 'columna': 7,
        'nombre_columna': 'Casos 2025–2026', 'suma_estados': 829, 'total_impreso': 830, 'delta': 1,
        'filas_con_identidad_rota': [{'estado': 'Chihuahua', 'col0': 0, 'col3': 2, 'col7_impreso': 1}],
        'estado': 'NO_RECONCILIADO', 'celdas_modificadas': 0,
        'decision': {
            'autor': 'TEST_ONLY AUTOR_SINTETICO', 'fecha': '2026-11-15',
            'texto_literal': 'TEST_ONLY ACTA_SINTETICA',
            'enlace_evidencia': '/ruta/inexistente/que/no/se/abre/acta.md',
            'evidencia_sha256': SHA_ACTA, 'solo_pruebas': True,
        },
    }
    reg.update(cambios)
    return reg


class FableDatosGuardsTest(unittest.TestCase):
    def test_f3_f5_provenancia_declarada_sin_abrir_acta_y_documentacion_honesta(self):
        with tempfile.NamedTemporaryFile('wb', suffix='.json') as f:
            crudo = json.dumps({'schema': bdf.SCHEMA, 'discrepancias': [registro_base()]}).encode('utf-8')
            f.write(crudo)
            f.flush()
            cargadas = bdf.cargar_disposiciones(Path(f.name), SHA_PDF)
            proy = bdf.proyectar_discrepancia_publica(cargadas['registros'][0], cargadas['file_sha256'])
            self.assertEqual(proy['authorization_sha256'], SHA_ACTA)
            self.assertEqual(proy['disposition_file_sha256'], hashlib.sha256(crudo).hexdigest())

        doc_norm = ' '.join((bdf.__doc__ or '').lower().split())
        readme_raw = (Path(__file__).resolve().parents[1] / 'scripts/README_radar_boletin.md').read_text(encoding='utf-8')
        readme_norm = ' '.join(readme_raw.split())
        self.assertIn('identificador declarado de provenancia', doc_norm)
        self.assertIn('no abre `enlace_evidencia`', doc_norm)
        self.assertIn('proyección por lista cerrada de 13 claves', readme_norm)
        self.assertIn('identificador declarado de provenancia', readme_norm)
        self.assertIn('no pretende ser un detector universal', readme_norm)
        self.assertIn('salvaguarda acotada de operador', readme_norm)
        self.assertNotIn(
            'verificarMiasis` falla cerrado si algún artefacto público expone esos metadatos privados',
            readme_norm,
        )

    def test_f6_canonicaliza_claves_de_filas_identidad_rota_y_rechaza_negativos(self):
        desordenada = {'col7_impreso': 1, 'col0': 0, 'estado': 'Chihuahua', 'col3': 2}
        doc = {'schema': bdf.SCHEMA, 'discrepancias': [registro_base(filas_con_identidad_rota=[desordenada])]}
        with tempfile.NamedTemporaryFile('w', suffix='.json', encoding='utf-8') as f:
            json.dump(doc, f, ensure_ascii=False)
            f.flush()
            cargadas = bdf.cargar_disposiciones(Path(f.name), SHA_PDF)
        self.assertEqual(
            list(cargadas['registros'][0]['filas_con_identidad_rota'][0].keys()),
            ['estado', 'col0', 'col3', 'col7_impreso'],
        )
        proy_directa = bdf.proyectar_discrepancia_publica(
            registro_base(filas_con_identidad_rota=[desordenada]), 'd' * 64
        )
        self.assertEqual(
            list(proy_directa['filas_con_identidad_rota'][0].keys()),
            ['estado', 'col0', 'col3', 'col7_impreso'],
        )
        desord_def = {'col9_impreso': 2, 'col2': 0, 'estado': 'Nayarit', 'col5': 1}
        proy_def = bdf.proyectar_discrepancia_publica(
            registro_base(columna=9, nombre_columna='Defunciones totales', filas_con_identidad_rota=[desord_def]),
            'd' * 64,
        )
        self.assertEqual(
            list(proy_def['filas_con_identidad_rota'][0].keys()),
            ['estado', 'col2', 'col5', 'col9_impreso'],
        )
        for fila_mala in (
            {'col7_impreso': 2, 'col0': 0, 'estado': 'Chihuahua', 'col3': 2},
            {'col7_impreso': 1, 'col0': 0, 'estado': 'Chihuahua', 'col3': 2, 'extra': 0},
            {'col0': 0, 'estado': 'Chihuahua', 'col3': 2},
        ):
            with self.assertRaises(bdf.ErrorDisposicion):
                bdf.proyectar_discrepancia_publica(registro_base(filas_con_identidad_rota=[fila_mala]), 'd' * 64)

    def test_f7_mas_de_una_pagina_miasis_falla_cerrado(self):
        simb = 'Simbología\n( - ) : no se presentaron casos  \n'
        p_miasis_ok = texto_miasis(total_col7=830, chih_col7='2')
        p_miasis_rota = texto_miasis(total_col7=830, chih_col7='1')

        texto_1pag = '\f'.join(['estatal', simb, p_miasis_ok]).encode('utf-8')
        with patch.object(extrae, 'paginas_xml', return_value=xml_paginas_sinteticas(1)):
            leido = extrae.leer(Path('/tmp/sint.pdf'), 2026, texto=texto_1pag)
            self.assertEqual(leido['miasis']['page'], 3)

        texto_2pag_ok = '\f'.join(['estatal', simb, p_miasis_ok, p_miasis_ok]).encode('utf-8')
        with patch.object(extrae, 'paginas_xml', return_value=xml_paginas_sinteticas(2)):
            with self.assertRaises(extrae.ErrorExtraccion) as ctx_ok:
                extrae.leer(Path('/tmp/sint.pdf'), 2026, texto=texto_2pag_ok)
            self.assertTrue(any(p.get('tipo') == 'miasis_paginas_multiples' for p in ctx_ok.exception.problemas))

        with tempfile.NamedTemporaryFile('w', suffix='.json', encoding='utf-8') as f:
            json.dump({'schema': bdf.SCHEMA, 'discrepancias': [registro_base(pagina=3)]}, f)
            f.flush()
            disp_p3 = bdf.cargar_disposiciones(Path(f.name), SHA_PDF)
        texto_2pag_mixta = '\f'.join(['estatal', simb, p_miasis_rota, p_miasis_ok]).encode('utf-8')
        with patch.object(extrae, 'paginas_xml', return_value=xml_paginas_sinteticas(2)):
            with self.assertRaises(extrae.ErrorExtraccion) as ctx_mix:
                extrae.leer(Path('/tmp/sint.pdf'), 2026, texto=texto_2pag_mixta, disposiciones=disp_p3)
            self.assertTrue(any(p.get('tipo') == 'miasis_paginas_multiples' for p in ctx_mix.exception.problemas))

    def test_f8a_exige_schema_en_ambas_formas(self):
        sin_schema_unico = registro_base()
        with tempfile.NamedTemporaryFile('w', suffix='.json', encoding='utf-8') as f:
            json.dump(sin_schema_unico, f)
            f.flush()
            with self.assertRaises(bdf.ErrorDisposicion) as ctx:
                bdf.cargar_disposiciones(Path(f.name), SHA_PDF)
            self.assertEqual(ctx.exception.problema['tipo'], 'disposicion_esquema_invalido')

        con_schema_unico = {'schema': bdf.SCHEMA, **registro_base()}
        with tempfile.NamedTemporaryFile('w', suffix='.json', encoding='utf-8') as f:
            json.dump(con_schema_unico, f)
            f.flush()
            cargadas = bdf.cargar_disposiciones(Path(f.name), SHA_PDF)
            self.assertEqual(len(cargadas['registros']), 1)

    def test_f8b_y_n5ab_rechaza_conteos_decimales_preserva_99_9_y_admite_negativos(self):
        filas_dec = [{'state': 'Chihuahua', 'values': [0.4, 0.0, 0.0, 1.6, 0.3, 0.0, 1.0, 1.0, 0.1, 0.0]}]
        with self.assertRaises(bdf.ErrorDisposicion):
            bdf.filas_identidad_rota_miasis(filas_dec, 7)

        filas_suma_dec = [
            {'state': 'Aguascalientes', 'values': [0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5, 0.0, 0.0]},
            {'state': 'Chihuahua', 'values': [0.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5, 0.0, 0.0]},
        ]
        with self.assertRaises(bdf.ErrorDisposicion):
            bdf.construir_problema_miasis(81, 0, 'Casos 2025', filas_suma_dec, [1, 100, 0, 0, 0, 0, 0, 1, 0, 0])

        probs_dec: list = []
        extrae.miasis(81, texto_miasis(total_col7=830, chih_col7='1.5', chih_col0='0.5'), 2026, probs_dec)
        self.assertTrue(any(p.get('tipo') == 'miasis_conteo_no_entero' for p in probs_dec))

        # N5(a): porcentaje total 99.9% NO se trunca a 99; 100.0% permanece entero 100.
        probs_pct: list = []
        tabla_pct = extrae.miasis(81, texto_miasis(total_col7=830, chih_col7='2', pct_total='99.9%'), 2026, probs_pct)
        self.assertEqual(probs_pct, [])
        self.assertEqual(tabla_pct['totals'][8], 99.9)
        self.assertEqual(tabla_pct['totals'][1], 100)

        # N5(b): conteos enteros negativos impresos NO se prohíben por gate inventado si cuadran.
        probs_neg: list = []
        tabla_neg = extrae.miasis(81, texto_miasis(total_col7=827, chih_col7='-1', chih_col0='-3'), 2026, probs_neg)
        self.assertEqual(tabla_neg['states'][1]['values'][0], -3.0)
        self.assertFalse(any(p.get('tipo') == 'miasis_conteo_no_entero' for p in probs_neg))


if __name__ == '__main__':
    unittest.main()
