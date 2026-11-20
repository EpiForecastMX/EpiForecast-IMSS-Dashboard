# Pronóstico — Anencefalia (Q00)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `anencefalia_q00_release_b8dd98d57ec0`
- Lineage: forecast `anencefalia_q00_forecast_h52_af2e6de2748c_d3b5dcbe4f8b` · refit `anencefalia_q00_refit_final_9fe0414b00c7_af2e6de2748c` · dataset `anencefalia_q00_c3f7c70a279a`
- Origen 2026-W43 → horizonte 52 semanas
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
- Gate congelado `9da8692482ec47993dd98a33046898d92bdcbd6de42496478545b8c0c9484494`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
