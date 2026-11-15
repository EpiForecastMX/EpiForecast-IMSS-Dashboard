# Pronóstico — Fiebre reumática aguda (I00, I01, I02)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `reumatica_i00_release_6ed116c23499`
- Lineage: forecast `reumatica_i00_forecast_h52_9b9a65b9f116_0af64e671a06` · refit `reumatica_i00_refit_final_9fe0414b00c7_9b9a65b9f116` · dataset `reumatica_i00_6f3866cdcba8`
- Origen 2026-W42 → horizonte 52 semanas
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
- Gate congelado `c8e67f82af634216ffd16cbb111de43f4baa5fc643f689ce44744c09d900bce2`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
