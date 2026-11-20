# Pronóstico — Tifo murino (A75.2)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `tifo_murino_a752_release_d0c157fd3d15`
- Lineage: forecast `tifo_murino_a752_forecast_h52_5efbc7da37fd_3f7d454841dd` · refit `tifo_murino_a752_refit_final_9fe0414b00c7_5efbc7da37fd` · dataset `tifo_murino_a752_69c79c925e08`
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
- Gate congelado `b86d545efc47878b27e45b9c8f738b6681c07f7d1733217945e3f513a6f2211a`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
