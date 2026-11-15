# Pronóstico — Bocio endémico (E01)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `bocio_e01_release_07940d3a8530`
- Lineage: forecast `bocio_e01_forecast_h52_d83919a668e8_67e009f1d2a8` · refit `bocio_e01_refit_final_9fe0414b00c7_d83919a668e8` · dataset `bocio_e01_0fd229f0dc96`
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
- Gate congelado `a17e419761680fbaea76f236ea54c13d4653f8cd1dba582fe652502e8ee44545`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
