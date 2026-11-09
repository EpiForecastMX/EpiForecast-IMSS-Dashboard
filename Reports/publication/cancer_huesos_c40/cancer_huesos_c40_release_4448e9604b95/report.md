# Pronóstico — Tumores malignos de los huesos y de los cartílagos articulares (C40, C41)

**Control estacional publicado: portafolio rechazado por el gate de aceptación, sin contraste prospectivo · pronóstico puntual sin intervalos**

- Release: `cancer_huesos_c40_release_4448e9604b95`
- Lineage: forecast `cancer_huesos_c40_forecast_h52_f6bae80d531e_28fff14c654f` · refit `cancer_huesos_c40_refit_final_9fe0414b00c7_f6bae80d531e` · dataset `cancer_huesos_c40_d2e864a2d1d0`
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
- Gate congelado `a3fba06135781514e366c177007552e1a6e4dc206d3396cdbb3f347281fb2cc8`.

**Lifecycle `published`**: release publicado desde su bundle sellado.
