# Pronóstico — Tuberculosis otras formas (A17.1, A17.8, A17.9, A18, A19)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `tuberculosis_otras_formas_a171_release_ca444e2b0856`
- Lineage: forecast `tuberculosis_otras_formas_a171_forecast_h52_6195d5eafd2c_89711ef20ec0` · refit `tuberculosis_otras_formas_a171_refit_final_9fe0414b00c7_6195d5eafd2c` · dataset `tuberculosis_otras_formas_a171_ed692b9053e8`
- Origen 2026-W44 → horizonte 52 semanas
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
- Gate congelado `2badde5360bc7b63a2e75c3c434a0e80c2816addabad7b7aa6c5294a7fa3a0f7`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
