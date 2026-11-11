"""El guion impreso por el boletín se conserva como marcador y nunca se convierte en 0.

Ejecutar desde la raíz del sitio:  python3 -m unittest discover -s scripts -p 'test_boletin*.py'

Fuentes reales (assets/boletin/2026-w43/sem43.pdf, sha256 f24aea93…):
- Cuadro 1, p. 9: «Simbología: ( - ) : no se presentaron casos. n.d. : información no disponible».
- Cuadro 3.4, p. 15: sarampión imprime guiones en todas sus columnas, también el acumulado 2025,
  mientras el boletín 2025-SE53 registra 6,152 casos confirmados de sarampión.
- Tuberculosis respiratoria, Jalisco: «-  507  256  808» (guion en la semana, cifras al lado).
- Enteritis por rotavirus, columna «Sem.»: 23 guiones y cifras que suman el TOTAL impreso (13).
Con el código anterior todas estas pruebas fallan: el guion se leía como 0.
"""
import csv
import io
import json
import shutil
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import boletin_celdas as celdas  # noqa: E402
import boletin_semana as gen  # noqa: E402
import boletin_semana_extrae as extrae  # noqa: E402
import boletin_semana_historia as historia  # noqa: E402

RAIZ = Path(__file__).resolve().parents[1]
W43 = RAIZ / 'assets/boletin/2026-w43'
NO_PUBLICADO = dict(semantica='no_publicado', desde=2025, nota='prueba', evidencia=[])


class Celdas(unittest.TestCase):
    def test_lectura_de_simbolos_y_cifras(self):
        self.assertEqual(extrae.valor('-'), '-')
        self.assertEqual(extrae.valor('0'), 0)
        self.assertEqual(extrae.valor('1 014'), 1014)
        self.assertEqual(extrae.valor('n.d.'), 'n.d.')
        self.assertEqual(extrae.valor('s.n.'), 's.n.')
        with self.assertRaises(ValueError):
            extrae.valor('x')

    def test_un_cero_impreso_sigue_siendo_cero_y_un_guion_no(self):
        self.assertEqual(celdas.numero(0), 0)
        self.assertEqual(celdas.numero('-'), 0)  # simbología: «no se presentaron casos»
        self.assertIsNone(celdas.numero('-', NO_PUBLICADO))  # la fuente lo contradice
        self.assertIsNone(celdas.numero('n.d.'))
        self.assertIsNone(celdas.numero(None))

    def test_sumas_no_rellenan(self):
        self.assertEqual(celdas.suma(['-', '-']), '-')
        self.assertEqual(celdas.suma(['-', 5]), 5)
        self.assertEqual(celdas.suma([0, 0]), 0)
        self.assertIsNone(celdas.suma(['-', 5], NO_PUBLICADO))
        self.assertIsNone(celdas.suma(['n.d.', 5]))
        self.assertEqual(celdas.suma(['n.d.', 'n.d.']), 'n.d.')

    def test_marcador_pegado_a_cifra_no_es_un_simbolo(self):
        self.assertEqual(extrae.valor('-3'), -3)      # cifra con signo impresa
        self.assertEqual(extrae.valor('145-'), 145)   # guion de la celda vecina, fundido
        for t in ('n.d.5', '-n.d.', '--5', 'x'):
            with self.assertRaises(ValueError, msg=t):
                extrae.valor(t)

    def test_reconciliacion_compara_solo_lo_comparable(self):
        self.assertTrue(celdas.reconcilia(['-', 1, '-', 12], 13))
        self.assertFalse(celdas.reconcilia(['-', 1, '-', 11], 13))
        self.assertTrue(celdas.reconcilia(['-', '-'], '-'))
        self.assertFalse(celdas.reconcilia(['-', 2], '-'))
        self.assertFalse(celdas.reconcilia(['n.d.', 2], 2))  # no se puede comprobar
        self.assertFalse(celdas.reconcilia(['-', '-'], 'n.d.'))


@unittest.skipUnless(shutil.which('pdftotext'), 'requiere pdftotext')
class FuenteReal(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ext = extrae.leer(W43 / 'sem43.pdf', 2026)
        cls.por_nombre = {b['nombre']: b for b in cls.ext['estatales']}

    def test_simbologia_impresa(self):
        s = self.ext['simbologia']
        self.assertEqual(s['simbolos']['-'], 'no se presentaron casos')
        self.assertEqual(s['simbolos']['n.d.'], 'información no disponible')
        self.assertEqual(s['paginas'], [9, 10])

    def test_sarampion_conserva_los_guiones(self):
        b = self.por_nombre['Sarampión']
        self.assertEqual(b['totals'], ['-', '-', '-', '-'])
        self.assertTrue(all(v == '-' for s in b['states'] for v in s['values']))
        self.assertEqual(b['cumulative'], '-')
        self.assertEqual(b['previous'], '-')

    def test_fila_con_guion_y_cifras(self):
        b = self.por_nombre['Tuberculosis respiratoria']
        jal = next(s for s in b['states'] if s['state'] == 'Jalisco')
        self.assertEqual(jal['values'], ['-', 507, 256, 808])
        self.assertEqual(extrae.acumulados(b['columns'], jal['values'], 2026), 763)

    def test_columna_con_guiones_reconcilia_con_su_total(self):
        b = self.por_nombre['Enteritis debida a rotavirus']
        sem = [s['values'][0] for s in b['states']]
        self.assertEqual(sem.count('-'), 23)
        self.assertEqual(b['totals'][0], 13)
        self.assertEqual(sum(v for v in sem if isinstance(v, int)), 13)

    def test_ningun_guion_se_guardo_como_cero(self):
        celdas_ = [v for b in self.ext['estatales'] for s in b['states'] for v in s['values']]
        self.assertEqual(celdas_.count('-'), 5956)  # más 62 en TOTAL y 99 en el resumen nacional
        self.assertEqual(sum(1 for v in celdas_ if v == 0 and not isinstance(v, str)), 0)

    def test_resumen_nacional(self):
        sar = next(n for n in self.ext['nacionales'] if n['code'] == 'B05')
        self.assertEqual([sar[k] for k in ('weekly', 'cumulative', 'median', 'weekly_previous',
                                           'previous')], ['-'] * 5)
        ebola = next(n for n in self.ext['nacionales'] if n['code'] == 'A98.4')
        self.assertEqual(ebola['median'], 'n.d.')


class FotoCorregida(unittest.TestCase):
    """La foto vigente (actual.json) es la revisión corregida de la semana 43."""

    @classmethod
    def setUpClass(cls):
        actual = json.loads((RAIZ / 'assets/boletin/actual.json').read_text())
        cls.carpeta = RAIZ / actual['carpeta']
        cls.datos = json.loads((cls.carpeta / 'data.json').read_text())
        cls.ids = {d['id']: d for d in cls.datos['diseases']}

    def test_original_sellado_intacto(self):
        import hashlib
        # La foto publicada el 9-nov-2026 no se reescribe: la corrección vive en su revisión.
        self.assertEqual(hashlib.sha256((W43 / 'data.json').read_bytes()).hexdigest(), 'ba86984c19dc54eae153c2987d29f712946c30f83090a4673d52205e8c353d3b')
        self.assertNotEqual(self.carpeta, W43)

    def test_sarampion_y_falciparum_son_cifras_no_publicadas(self):
        for ident in ('p10b2', 'p33b1'):
            d = self.ids[ident]
            self.assertEqual(d['guion']['semantica'], 'no_publicado', ident)
            self.assertTrue(d['guion']['evidencia'], ident)
            self.assertEqual(d['cumulative'], '-', ident)
            self.assertIsNone(d['score_parts']['carga'], ident)
        sar = next(n for n in self.datos['national'] if n['code'] == 'B05')
        self.assertEqual(sar['guion']['semantica'], 'no_publicado')

    def test_rubeola_sigue_la_simbologia(self):
        d = self.ids['p10b3']
        self.assertNotIn('guion', d)
        self.assertEqual(d['totals'], ['-', '-', '-', '-'])
        self.assertEqual(d['score_parts']['carga'], 0.0)

    def test_catalogo_csv_exporta_el_simbolo(self):
        filas = list(csv.reader(io.StringIO(
            (self.carpeta / 'catalogo.csv').read_text(encoding='utf-8-sig'))))
        sar = next(f for f in filas if f[0] == 'Sarampión')
        self.assertEqual(sar[4:7], ['-', '-', '-'])
        self.assertNotIn('nan', ''.join(sum(filas, [])).lower())

    def test_verificacion_cuenta_los_marcadores(self):
        v = json.loads((self.carpeta / 'verification.json').read_text())
        self.assertEqual(v['printed_markers'], {'-': 5956 + 62 + 99, 'n.d.': 14})
        self.assertEqual({o['id'] for o in v['dash_semantics_overrides']}, {'p10b2', 'p33b1'})


class Generador(unittest.TestCase):
    def test_puntaje_sin_acumulado_comparable_no_finge_un_cero(self):
        r = dict(states=[dict(state='A', values=['-', '-', '-'])], cumulative='-', previous='-',
                 guion=NO_PUBLICADO)
        activas, partes = gen.puntaje(r, 1000, 10)
        self.assertEqual(activas, 0)
        self.assertIsNone(partes['carga'])
        r['score_parts'] = partes
        previo = dict(status='Por incorporar', aggregate=False, priority='Alta', score=80)
        self.assertEqual(gen.prioridad(r, previo), ('Exploración', None))

    def test_guion_bajo_simbologia_cuenta_como_cero(self):
        r = dict(states=[dict(state='A', values=['-', 3, '-'])], cumulative=3, previous='-')
        activas, partes = gen.puntaje(r, 1000, 10)
        self.assertEqual(partes['crecimiento'], 0)
        self.assertGreater(partes['carga'], 0)

    def test_fila_nacional_sin_cifra(self):
        self.assertFalse(gen.sin_cifra('-'))
        self.assertTrue(gen.sin_cifra('n.d.'))
        self.assertTrue(gen.sin_cifra(None))
        self.assertFalse(gen.sin_cifra(0))


class MigracionGuardas(unittest.TestCase):
    """La migración del histórico exige evidencia positiva y bytes verificados."""

    @classmethod
    def setUpClass(cls):
        import boletin_marcadores_migra as mig
        cls.mig = mig
        cls.estados = json.loads((RAIZ / historia.DIR / 'index.json').read_text())['states']

    def punto(self, e=True):
        return dict(n=[0, 0], prev=0, e=[[0, 0]] * 32 if e else None, flags=[])

    def test_pagina_vacia_o_no_reconocida_no_autoriza(self):
        for texto in ('', 'Vigilancia Epidemiológica Semana 43, 2026\n\n     15\n'):
            lectura = self.mig.filas_de_datos(texto, self.estados)
            self.assertEqual(self.mig.motivo_para_no_migrar(self.punto(), lectura, 32),
                             'pagina_sin_filas_de_datos_reconocidas')

    def test_pagina_real_con_guiones_si_autoriza(self):
        import subprocess
        texto = subprocess.run(['pdftotext', '-f', '15', '-l', '15', '-layout',
                                str(W43 / 'sem43.pdf'), '-'], capture_output=True,
                               text=True).stdout
        lectura = self.mig.filas_de_datos(texto, self.estados)
        self.assertEqual(lectura['entidades'], 32)
        self.assertGreaterEqual(lectura['guiones'], 66)
        self.assertIsNone(self.mig.motivo_para_no_migrar(self.punto(), lectura, 32))

    def test_entidades_por_prefijo_mas_largo_y_nombre_historico(self):
        nombres = [('Distrito Federal' if e == 'Ciudad de México' else e) for e in self.estados]
        filas = '\n'.join(f'{e}   -   5   -   -' for e in nombres) + '\nTOTAL  -  160  -  -\n'
        lectura = self.mig.filas_de_datos(filas, self.estados)
        self.assertEqual(lectura['entidades'], 32)
        self.assertIsNone(self.mig.motivo_para_no_migrar(self.punto(), lectura, 32))

    def test_cero_literal_o_pocos_guiones_no_autoriza(self):
        filas = '\n'.join(f'{e}   -   5   0' for e in self.estados) + '\nTOTAL  -  160  0\n'
        lectura = self.mig.filas_de_datos(filas, self.estados)
        self.assertEqual(self.mig.motivo_para_no_migrar(self.punto(), lectura, 32),
                         'pagina_con_cero_literal')
        filas = '\n'.join(f'{e}   7   5   9' for e in self.estados) + '\nTOTAL  -  160  9\n'
        lectura = self.mig.filas_de_datos(filas, self.estados)
        self.assertEqual(self.mig.motivo_para_no_migrar(self.punto(), lectura, 32),
                         'menos_guiones_impresos_que_ceros')
        filas = '\n'.join(f'{e}   -   5   -' for e in self.estados[:20])
        lectura = self.mig.filas_de_datos(filas, self.estados)
        self.assertEqual(self.mig.motivo_para_no_migrar(self.punto(), lectura, 32),
                         'pagina_sin_las_32_entidades_y_total')

    def test_fuente_adulterada_se_rechaza_por_digest(self):
        import hashlib
        import tempfile
        tmp = Path(tempfile.mkdtemp(prefix='radar-fuentes-'))
        try:
            bueno = tmp / 'bueno.pdf'
            bueno.write_bytes((W43 / 'sem43.pdf').read_bytes())
            malo = tmp / 'malo.pdf'
            malo.write_bytes((W43 / 'sem43.pdf').read_bytes() + b'%adulterado')
            digest = hashlib.sha256(bueno.read_bytes()).hexdigest()
            (tmp / 'manifiesto.json').write_text(json.dumps([
                dict(sha256=digest, archivo='bueno.pdf', verificado=True),
                dict(sha256=digest, archivo='malo.pdf', verificado=True),
                dict(sha256='f' * 64, archivo='bueno.pdf', verificado=True)]))
            pdfs, rechazados = self.mig.fuentes_verificadas([tmp], {digest})
            self.assertEqual(pdfs, {digest: bueno})
            self.assertEqual(len(rechazados), 2)
        finally:
            shutil.rmtree(tmp)


class Historia(unittest.TestCase):
    def test_punto_conserva_guiones_y_no_falla(self):
        estados = ['A', 'B']
        d = dict(id='x', observed_week=42, page=1, columns=['Sem.', 'H', 'M', 'Acum. 2025'],
                 totals=[1, '-', 4, '-'], weekly=1, cumulative=4, previous='-',
                 states=[dict(state='A', values=['-', '-', '-', '-']),
                         dict(state='B', values=[1, '-', 4, '-'])])
        _, p = historia.punto(d, 2026, 43, 0, estados)
        self.assertEqual(p['e'], [['-', '-'], [1, 4]])
        self.assertEqual(p['prev'], '-')
        self.assertEqual(p['flags'], [])

    def test_curvas_vigentes_sin_cero_inventado(self):
        index, shards = historia.cargar(RAIZ / historia.DIR)
        cat = {c['id']: c for c in index['categories']}
        self.assertEqual(cat['p10b2']['guion']['semantica'], 'no_publicado')
        self.assertIn('-', index['symbols']['simbolos'])
        sar = shards['p10b2']
        ultimo = sar['points'][-1]
        self.assertEqual(ultimo['n'], ['-', '-'])
        self.assertTrue(all(v == '-' for fila in ultimo['e'] for v in fila))
        # Ningún punto de sarampión 2025-2026 conserva un 0 que la fuente imprimió como guion.
        self.assertFalse([p for p in sar['points'] if 0 in p['n']])

    def test_csv_nacional_exporta_el_guion(self):
        index, shards = historia.cargar(RAIZ / historia.DIR)
        texto = historia.csv_nacional(index, shards).decode('utf-8-sig')
        filas = [f for f in csv.reader(io.StringIO(texto)) if f[0] == 'Sarampión']
        self.assertTrue(filas)
        # 2026-W01 es un corte contradictorio de la fuente: sin cifra (vacío), no un guion ni un 0.
        self.assertTrue(all(f[4] == '-' or (f[4] == '' and 'source_cut_conflict' in f[12])
                            for f in filas if f[2] == '2026'))
        self.assertFalse([f for f in filas if f[4] == '0'])


if __name__ == '__main__':
    unittest.main()
