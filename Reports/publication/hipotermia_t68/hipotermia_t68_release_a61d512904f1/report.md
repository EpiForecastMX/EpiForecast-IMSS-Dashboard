# Pronóstico — Hipotermia (T68)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `hipotermia_t68_release_a61d512904f1`
- Lineage: forecast `hipotermia_t68_forecast_h52_b91f3c93c639_171e269ca9bc` · refit `hipotermia_t68_refit_final_9fe0414b00c7_b91f3c93c639` · dataset `hipotermia_t68_015a7c10ac40`
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
- Veredicto `INCOMPLETE` · 1 de 4 semanas objetivo con verdad disponible.
- Gate congelado `0dec1fe010bac8f4e34f8ae8d433fcbc66500478cacd8f0f5a09496db7978041`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
