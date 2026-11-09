"""Regresión del generador semanal del radar contra la foto publicada de la semana 42.

Ejecutar desde la raíz del sitio:  python3 -m unittest discover -s scripts -p 'test_boletin*.py'

La prueba de extracción vuelve a leer el PDF de la semana 42 con la foto 42 como «anterior»
(para heredar la cobertura) y exige los mismos bytes en data.json, catalogo.csv,
verification.json, boletin.txt y el PDF, y el mismo contenido en encabezados-ocr.json
(el orden de claves de la primera publicación era arbitrario). Requiere Poppler y Tesseract;
sin ellos se omite. La prueba del histórico retira la semana 42 de las curvas y la vuelve a
agregar desde la foto: el resultado debe ser idéntico byte a byte.
"""
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

sys.path.insert(0, str(Path(__file__).resolve().parent))
import boletin_semana as gen  # noqa: E402
import boletin_semana_cortes as cortes  # noqa: E402
import boletin_semana_extrae as extrae  # noqa: E402
import boletin_semana_historia as historia  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
W42 = RAIZ / 'assets/boletin/2026-w42'
URL = 'https://www.gob.mx/cms/uploads/attachment/file/1113914/Boletin-4226.pdf'
HERRAMIENTAS = all(shutil.which(t) for t in ('pdftotext', 'pdftoppm', 'tesseract'))


def correr(*args):
    salida, errores = io.StringIO(), io.StringIO()
    with redirect_stdout(salida), redirect_stderr(errores):
        rc = gen.main(list(args))
    return rc, salida.getvalue(), errores.getvalue()


def base(anterior, salida):
    return ['--pdf', str(W42 / 'boletin-4226.pdf'), '--url-fuente', URL, '--publicacion',
            '2026-11-02', '--comprobado', '2026-11-08', '--anterior', str(anterior),
            '--salida', str(salida), '--sin-activar', '--sin-historia']


@unittest.skipUnless(HERRAMIENTAS, 'requiere pdftotext, pdftoppm y tesseract')
class RegresionSemana42(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix='radar-w42-'))
        cls.rc, cls.out, cls.err = correr(*base(W42, cls.tmp / 'foto'))

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def test_reproduce_la_foto_publicada(self):
        self.assertEqual(self.rc, 0, self.err)
        for nombre in ('data.json', 'catalogo.csv', 'verification.json', 'boletin.txt',
                       'boletin-4226.pdf'):
            with self.subTest(archivo=nombre):
                self.assertEqual((self.tmp / 'foto' / nombre).read_bytes(),
                                 (W42 / nombre).read_bytes())
        leer = lambda p: json.loads((p / 'encabezados-ocr.json').read_text())  # noqa: E731
        self.assertEqual(leer(self.tmp / 'foto'), leer(W42))

    def test_identidad_ausente_falla_cerrado(self):
        anterior = self.tmp / 'anterior-sin-depresion'
        anterior.mkdir()
        datos = json.loads((W42 / 'data.json').read_text())
        datos['diseases'] = [d for d in datos['diseases'] if d['id'] != 'p70b1']
        (anterior / 'data.json').write_text(json.dumps(datos, ensure_ascii=False))
        rc, _, err = correr(*base(anterior, self.tmp / 'no-debe-existir'))
        self.assertEqual(rc, 1)
        self.assertIn('identidad', err)
        self.assertFalse((self.tmp / 'no-debe-existir').exists())


@unittest.skipUnless(shutil.which('pdftotext'), 'requiere pdftotext')
class ReconciliacionCerrada(unittest.TestCase):
    def test_una_celda_alterada_detiene_la_extraccion(self):
        original = extrae.palabras

        def alterada(p):
            ws = original(p)
            for w in ws:
                if w['t'] == 'Aguascalientes':
                    fila = [v for v in ws if abs(v['y'] - w['y']) < 2 and v['x'] > 125]
                    numero = next((v for v in fila if v['t'].isdigit()), None)
                    if numero:
                        numero['t'] = str(int(numero['t']) + 1)
                        break
            return ws

        extrae.palabras = alterada
        try:
            with self.assertRaises(extrae.ErrorExtraccion) as e:
                extrae.leer(W42 / 'boletin-4226.pdf', 2026)
        finally:
            extrae.palabras = original
        self.assertTrue(any(p['tipo'] == 'reconciliacion' for p in e.exception.problemas))


class Historico(unittest.TestCase):
    def test_retirar_y_volver_a_agregar_la_semana_42_es_identico(self):
        hist = RAIZ / historia.DIR
        index, shards = historia.cargar(hist)
        index0, shards0 = historia.compacto(index), {k: historia.compacto(v)
                                                     for k, v in shards.items()}
        self.assertEqual(historia.csv_nacional(index, shards),
                         (hist / 'nacional-2013-2026.csv').read_bytes())
        historia.retirar_ultima(index, shards)
        datos = json.loads((W42 / 'data.json').read_text())
        sha = hashlib.sha256((W42 / 'boletin-4226.pdf').read_bytes()).hexdigest()
        revisadas = historia.incorporar(index, shards, datos, URL, sha,
                                        json.loads(index0)['checked'])
        self.assertEqual(revisadas, [])
        self.assertEqual(historia.compacto(index), index0)
        for k, texto in shards0.items():
            self.assertEqual(historia.compacto(shards[k]), texto, k)
        self.assertEqual(historia.csv_nacional(index, shards),
                         (hist / 'nacional-2013-2026.csv').read_bytes())

    def test_la_misma_semana_no_se_agrega_dos_veces(self):
        index, shards = historia.cargar(RAIZ / historia.DIR)
        datos = json.loads((W42 / 'data.json').read_text())
        sha = hashlib.sha256((W42 / 'boletin-4226.pdf').read_bytes()).hexdigest()
        with self.assertRaises(historia.FalloHistoria):
            historia.incorporar(index, shards, copy.deepcopy(datos), URL, sha, '2026-11-08')
        siguiente = copy.deepcopy(datos)
        siguiente['meta']['week'] = 42
        with self.assertRaises(historia.FalloHistoria):
            historia.incorporar(index, shards, siguiente, URL, 'f' * 64, '2026-11-08')


class Cortes(unittest.TestCase):
    OCR = json.loads((W42 / 'encabezados-ocr.json').read_text())

    def caso(self, pagina, nombre, esperado):
        self.assertEqual(cortes.corte(self.OCR[str(pagina)], nombre)[0], esperado)

    def test_corte_general_y_especificos(self):
        self.caso(6, 'Enteritis debida a rotavirus', 41)
        self.caso(6, 'Meningitis tuberculosa', 42)
        self.caso(10, 'Varicela', 41)
        self.caso(10, 'Sarampión', 42)
        self.caso(14, 'Cólera', 42)
        self.caso(24, 'Sífilis adquirida', 41)
        self.caso(24, 'Sífilis congénita', 42)

    def test_ocr_defectuoso_y_siglas(self):
        # «epidemtolégica 41» es el corte general del cuadro 13.10; ESAVI va hasta la 42.
        self.caso(57, 'Hipotermia', 41)
        self.caso(57, 'Eventos supuestamente asociados a la vacunación  (ESAVI)', 42)

    def test_sin_corte_no_se_adivina(self):
        self.assertIsNone(cortes.corte('CUADRO sin corte legible', 'Influenza'))

    def test_semanas_validas_en_cambio_de_anio(self):
        self.assertEqual(cortes.semanas_validas(2027, 1, 53), {(2027, 1), (2026, 53)})


class Calendario(unittest.TestCase):
    def test_periodos(self):
        self.assertEqual(gen.periodo(2026, 42), '18–24 de octubre de 2026')
        self.assertEqual(gen.periodo(2026, 40), '4–10 de octubre de 2026')
        self.assertEqual(gen.periodo(2026, 44), '1–7 de noviembre de 2026')
        self.assertEqual(gen.periodo(2026, 39), '27 de septiembre–3 de octubre de 2026')
        self.assertEqual(gen.periodo(2026, 1), '4–10 de enero de 2026')
        self.assertEqual(gen.periodo(2025, 53), '28 de diciembre de 2025–3 de enero de 2026')
        self.assertEqual(gen.semanas_en(2025), 53)
        self.assertEqual(gen.semanas_en(2026), 52)


if __name__ == '__main__':
    unittest.main()
