# Pronóstico — Gingivitis y enfermedad periodontal (K05)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `gingivitis_k05_release_9a2bcab11a53`
- Lineage: forecast `gingivitis_k05_forecast_h52_f4154619fa62_038636600236` · refit `gingivitis_k05_refit_final_9fe0414b00c7_f4154619fa62` · dataset `gingivitis_k05_c16b3f4b6dbe`
- Origen 2026-W41 → horizonte 52 semanas
- 64 modelos finales sobre 64 series base; 47 productos derivados por suma → 111 productos, 5772 filas

## Motores del portafolio

| motor | series base |
| --- | ---: |
| `seasonal_naive_lag52` | 64 |

## Incertidumbre

- **Pronóstico puntual; sin intervalo de incertidumbre.** `interval_method=none`; los límites viajan nulos y no deben dibujarse como cero.
- Los 47 productos derivados se atribuyen al portafolio, no a un motor concreto: son la suma de las series base.

## Validación prospectiva

- **Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**
- Veredicto `INCOMPLETE` · 0 de 4 semanas objetivo con verdad disponible.
- Gate congelado `6a4ce42b78f803276ff7647a0e10c1667599bae634bd66571d58396bffe0329f`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
