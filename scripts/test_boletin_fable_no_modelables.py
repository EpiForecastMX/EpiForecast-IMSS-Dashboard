"""Las categorías no modelables (alta_b44) conservan su estado y su motivo medido en la foto de la semana siguiente."""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import boletin_semana as gen  # noqa: E402
import test_boletin_fable_cli as cli  # noqa: E402

MOTIVO = 'En el boletín 44 no imprime casos en 2026 ni en el acumulado comparable de 2025.'


class NoModelableHeredado(cli.FableCliGuardsTest):
    def setUp(self):
        super().setUp()
        previa = cli.previa_sintetica()
        e = previa['diseases'][0]
        e.update(status='No modelable', reason=MOTIVO, priority='No aplica', score=None)
        ks = list(e)
        i = ks.index('source_note') + 1
        previa['diseases'][0] = {**{k: e[k] for k in ks[:i]}, 'no_modelable': {'grupo': 'sin_casos'},
                                 **{k: e[k] for k in ks[i:]}}
        (self.raiz / 'assets/boletin/2026-w43-r1/data.json').write_text(json.dumps(previa), encoding='utf-8')

    def test_estado_motivo_y_grupo_pasan_a_la_foto_siguiente_sin_puntaje(self):
        disp = self.externo / 'disp_solo_pruebas.json'
        disp.write_text(json.dumps(cli.disposicion_doc(solo_pruebas=True, autor_prefix='')), encoding='utf-8')
        salida = self.externo / 'salida_no_modelable'
        rc, _, err = self._correr('--salida', str(salida), '--discrepancias-fuente', str(disp),
                                  '--sin-activar', '--sin-historia')
        self.assertEqual(rc, 0, err)
        e = json.loads((salida / 'data.json').read_text(encoding='utf-8'))['diseases'][0]
        self.assertEqual(e['status'], 'No modelable')
        self.assertEqual(e['no_modelable'], {'grupo': 'sin_casos'})
        self.assertEqual(e['reason'], MOTIVO)
        self.assertEqual((e['priority'], e['score']), ('No aplica', None))
        ks = list(e)
        self.assertEqual(ks.index('no_modelable'), ks.index('source_note') + 1)

    def test_prioridad_no_reabre_el_puntaje_de_un_no_modelable(self):
        r = {'score_parts': {'carga': 20.0, 'afinidad': 30.0, 'dispersion': 20.0, 'crecimiento': 10.0},
             'states': [{}], 'cumulative': 5000}
        previo = {'status': 'No modelable', 'aggregate': False, 'priority': 'No aplica', 'score': None}
        self.assertEqual(gen.prioridad(r, previo), ('No aplica', None))

    # Las pruebas heredadas de FableCliGuardsTest ya corren en su propio archivo.
    test_f1_rechaza_input_privado_bajo_cualquier_ruta_de_raiz_sitio = None
    test_f2_test_only_prohibe_toda_salida_bajo_raiz_y_permite_externa_aislada = None
    test_f8c_cargadas_malformadas_captura_error_disposicion_rc1_sin_traza_ni_escritura = None
    test_n5c_expanduser_coherente_en_cli_y_guardas = None


if __name__ == '__main__':
    unittest.main()
